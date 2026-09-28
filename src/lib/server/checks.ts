import { parseExpected } from './status';
import type { CheckResult, Monitor, MonitorState } from './types';

export const USER_AGENT = 'Bonk/0.1 (+https://github.com/gege-mn/bonk)';

export interface CheckOutcome {
	result: CheckResult;
	latency: number | null;
	message: string;
	/** Nothing was measured this time (e.g. still waiting for a first ping); record nothing. */
	skip?: boolean;
	/** Extra detail for the admin's "Test" panel; never stored. */
	detail?: {
		status?: number;
		statusText?: string;
		headers?: Record<string, string>;
		body?: string;
	};
}

const BODY_LIMIT = 256 * 1024;

export async function runCheck(
	m: Monitor,
	state?: Pick<MonitorState, 'last_push_at'> | null,
	now = Math.floor(Date.now() / 1000)
): Promise<CheckOutcome> {
	try {
		switch (m.type) {
			case 'http':
			case 'keyword':
			case 'json':
				return await checkHttp(m);
			case 'tcp':
				return await checkTcp(m);
			case 'dns':
				return await checkDns(m);
			case 'push':
				return checkPush(m, state?.last_push_at ?? null, now);
		}
	} catch (e) {
		const message = describeError(e, m.timeout_ms);
		// Hitting the Workers per-invocation subrequest cap says nothing about the target.
		if (/too many subrequests/i.test(message)) return { result: 'down', latency: null, message, skip: true };
		return { result: 'down', latency: null, message };
	}
}

function describeError(e: unknown, timeoutMs: number): string {
	if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
		return `Timed out after ${(timeoutMs / 1000).toFixed(0)} s`;
	}
	const msg = e instanceof Error ? e.message : String(e);
	return msg.slice(0, 200) || 'Request failed';
}

function slowOrUp(m: Monitor, latency: number, okMessage: string): CheckOutcome {
	if (m.slow_ms && latency > m.slow_ms) {
		return {
			result: 'degraded',
			latency,
			message: `${fmtMs(latency)} (slow above ${fmtMs(m.slow_ms)})`
		};
	}
	return { result: 'up', latency, message: okMessage };
}

export const fmtMs = (ms: number) => `${ms.toLocaleString('en-US')} ms`;

async function checkHttp(m: Monitor): Promise<CheckOutcome> {
	const url = new URL(m.target);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('URL must start with http:// or https://');

	const headers = new Headers({ 'user-agent': USER_AGENT, 'cache-control': 'no-cache' });
	for (const [k, v] of Object.entries(parseHeaders(m.headers))) headers.set(k, v);

	const method = m.method.toUpperCase();
	const started = Date.now();
	const res = await fetch(url, {
		method,
		headers,
		body: ['GET', 'HEAD'].includes(method) ? undefined : (m.body ?? undefined),
		redirect: m.follow_redirects ? 'follow' : 'manual',
		signal: AbortSignal.timeout(m.timeout_ms),
		cache: 'no-store'
	});
	const needsBody = m.type !== 'http';
	const text = needsBody || method !== 'HEAD' ? await readBody(res, needsBody ? BODY_LIMIT : 2048) : '';
	const latency = Date.now() - started;

	const detail: CheckOutcome['detail'] = {
		status: res.status,
		statusText: res.statusText,
		headers: Object.fromEntries(res.headers),
		body: text.slice(0, 2000)
	};
	const statusLine = `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}`;

	if (!parseExpected(m.expected_status)(res.status)) {
		return { result: 'down', latency, message: statusLine, detail };
	}

	if (m.type === 'keyword') {
		const kw = m.keyword ?? '';
		const found = kw !== '' && text.includes(kw);
		if (m.keyword_invert ? found : !found) {
			const msg = m.keyword_invert ? `Found "${kw}" in the response` : `"${kw}" not found in the response`;
			return { result: 'down', latency, message: msg, detail };
		}
	}

	if (m.type === 'json') {
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch {
			return { result: 'down', latency, message: 'Response is not valid JSON', detail };
		}
		const value = readPath(data, m.json_path ?? '');
		const expected = (m.json_expected ?? '').trim();
		const got = value === undefined ? undefined : typeof value === 'string' ? value : JSON.stringify(value);
		const ok = expected === '' ? value !== undefined && value !== null && value !== false : got === expected;
		if (!ok) {
			const msg =
				got === undefined
					? `Nothing at ${m.json_path || '(root)'}`
					: `${m.json_path} is ${truncate(got, 60)}${expected ? `, expected ${truncate(expected, 60)}` : ''}`;
			return { result: 'down', latency, message: msg, detail };
		}
	}

	const out = slowOrUp(m, latency, statusLine);
	out.detail = detail;
	return out;
}

async function readBody(res: Response, limit: number): Promise<string> {
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (size < limit) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		size += value.byteLength;
	}
	await reader.cancel().catch(() => {});
	const buf = new Uint8Array(Math.min(size, limit));
	let off = 0;
	for (const c of chunks) {
		const take = Math.min(c.byteLength, buf.byteLength - off);
		buf.set(c.subarray(0, take), off);
		off += take;
		if (off >= buf.byteLength) break;
	}
	return new TextDecoder().decode(buf);
}

export function parseHeaders(raw: string): Record<string, string> {
	if (!raw || !raw.trim()) return {};
	const parsed: unknown = JSON.parse(raw);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Headers must be a JSON object');
	return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
}

/** Dot/bracket path: "status", "data.items[0].ok", "$.a.b". */
export function readPath(data: unknown, path: string): unknown {
	const clean = path.trim().replace(/^\$\.?/, '');
	if (!clean) return data;
	const keys = clean.match(/[^.[\]]+/g) ?? [];
	let cur: unknown = data;
	for (const k of keys) {
		if (cur === null || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[k];
	}
	return cur;
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function parseHostPort(target: string): { hostname: string; port: number } {
	const m = /^\[?([^\]]+?)\]?:(\d{1,5})$/.exec(target.trim());
	if (!m) throw new Error('Use host:port, e.g. example.com:22');
	const port = Number(m[2]);
	if (port < 1 || port > 65535) throw new Error('Port must be 1–65535');
	return { hostname: m[1], port };
}

async function checkTcp(m: Monitor): Promise<CheckOutcome> {
	const { hostname, port } = parseHostPort(m.target);
	// Dynamic so `vite dev` (Node) can still load the rest of this module.
	const { connect } = await import('cloudflare:sockets');
	const started = Date.now();
	const socket = connect({ hostname, port });
	try {
		await Promise.race([
			socket.opened,
			new Promise((_, reject) =>
				setTimeout(() => reject(new DOMException('timeout', 'TimeoutError')), m.timeout_ms)
			)
		]);
		const latency = Date.now() - started;
		return slowOrUp(m, latency, `Port ${port} open`);
	} finally {
		socket.close().catch(() => {});
	}
}

const DNS_TYPES: Record<string, number> = { A: 1, AAAA: 28, CNAME: 5, MX: 15, TXT: 16, NS: 2 };
export const DNS_RECORD_TYPES = Object.keys(DNS_TYPES);

async function checkDns(m: Monitor): Promise<CheckOutcome> {
	const type = DNS_TYPES[m.dns_type] ? m.dns_type : 'A';
	const url = new URL('https://cloudflare-dns.com/dns-query');
	url.searchParams.set('name', m.target.trim());
	url.searchParams.set('type', type);
	const started = Date.now();
	const res = await fetch(url, {
		headers: { accept: 'application/dns-json' },
		signal: AbortSignal.timeout(m.timeout_ms)
	});
	const latency = Date.now() - started;
	if (!res.ok) return { result: 'down', latency, message: `Resolver returned HTTP ${res.status}` };
	const data = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
	if (data.Status !== 0) {
		const names: Record<number, string> = { 2: 'SERVFAIL', 3: 'NXDOMAIN', 5: 'REFUSED' };
		return { result: 'down', latency, message: `DNS ${names[data.Status] ?? `error ${data.Status}`}` };
	}
	const answers = (data.Answer ?? []).filter((a) => a.type === DNS_TYPES[type]).map((a) => a.data.replace(/^"|"$/g, ''));
	if (!answers.length) return { result: 'down', latency, message: `No ${type} records` };
	const expected = (m.dns_expected ?? '').trim();
	if (expected && !answers.some((a) => a.replace(/\.$/, '') === expected.replace(/\.$/, '') || a.includes(expected))) {
		return { result: 'down', latency, message: `${type} is ${truncate(answers.join(', '), 80)}, expected ${expected}` };
	}
	return slowOrUp(m, latency, `${type} ${truncate(answers.join(', '), 80)}`);
}

function checkPush(m: Monitor, lastPush: number | null, now: number): CheckOutcome {
	// A little grace so a job that pings on the minute isn't flagged by cron jitter.
	const grace = Math.max(60, Math.round(m.interval_s * 0.1));
	if (lastPush === null) {
		const waited = now - m.created_at;
		if (waited <= m.interval_s + grace) return { result: 'up', latency: null, message: 'Waiting for the first ping', skip: true };
		return { result: 'down', latency: null, message: `No ping since the monitor was created ${fmtDuration(waited)} ago` };
	}
	const age = now - lastPush;
	if (age > m.interval_s + grace) return { result: 'down', latency: null, message: `No ping for ${fmtDuration(age)}` };
	return { result: 'up', latency: null, message: `Last ping ${fmtDuration(age)} ago` };
}

export function fmtDuration(s: number): string {
	if (s < 90) return `${Math.max(0, Math.round(s))} s`;
	if (s < 5400) return `${Math.round(s / 60)} min`;
	if (s < 172800) return `${Math.round(s / 3600)} h`;
	return `${Math.round(s / 86400)} days`;
}
