import type { Alert, ProviderConfig } from './types';

export type Tone = 'down' | 'degraded' | 'up' | 'test';

/** What the alert means now: reminders take the tone of the state they repeat. */
export function tone(alert: Alert): Tone {
	if (alert.kind === 'test') return 'test';
	if (alert.kind === 'reminder') return alert.to === 'up' ? 'up' : alert.to;
	return alert.kind;
}

export function title(alert: Alert): string {
	const name = alert.monitor.name;
	switch (alert.kind) {
		case 'down':
			return `Down · ${name}`;
		case 'degraded':
			return `Degraded · ${name}`;
		case 'up':
			return `Recovered · ${name}`;
		case 'reminder':
			return `${alert.to === 'degraded' ? 'Still degraded' : 'Still down'} · ${name}`;
		case 'test':
			return 'Test · Bonk';
	}
}

export function duration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	if (s < 60) return `${s} s`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	if (s < 86400) {
		const h = Math.floor(s / 3600);
		const m = Math.round((s % 3600) / 60);
		return m ? `${h} h ${m} min` : `${h} h`;
	}
	const d = Math.floor(s / 86400);
	const h = Math.round((s % 86400) / 3600);
	return h ? `${d} d ${h} h` : `${d} d`;
}

export function time(at: number): string {
	const d = new Date(at * 1000);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export function iso(at: number): string {
	return new Date(at * 1000).toISOString();
}

interface Parts {
	reason: string;
	target: string;
	downFor: string;
	time: string;
	link: string;
}

function parts(alert: Alert): Parts {
	let downFor = '';
	if (alert.downFor !== undefined) {
		const state = alert.from === 'degraded' ? 'degraded' : 'down';
		downFor = `Was ${state} for ${duration(alert.downFor)}`;
	}
	return {
		reason: alert.reason.trim(),
		target: alert.monitor.target.trim(),
		downFor,
		time: time(alert.at),
		link: alert.link?.trim() ?? ''
	};
}

export interface LineOptions {
	/** Leave the link out, e.g. when the service shows it as a button or clickable title. */
	link?: boolean;
}

export function lines(alert: Alert, opts: LineOptions = {}): string[] {
	const p = parts(alert);
	const out = [p.reason, p.target, p.downFor, p.time];
	if (opts.link !== false) out.push(p.link);
	return out.filter(Boolean);
}

export function plainText(alert: Alert, opts: LineOptions = {}): string {
	return [title(alert), ...lines(alert, opts)].join('\n');
}

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

/** Backslash-escapes the CommonMark/Discord characters that would restyle text. URLs stay raw so they still autolink. */
export function escapeMarkdown(s: string): string {
	if (isUrl(s)) return s;
	return s.replace(/([\\`*_~|[\]<>#])/g, '\\$1');
}

export function markdownLines(alert: Alert, opts: LineOptions = {}): string[] {
	return lines(alert, opts).map(escapeMarkdown);
}

export function markdown(alert: Alert, opts: LineOptions = {}): string {
	return [`**${escapeMarkdown(title(alert))}**`, ...markdownLines(alert, opts)].join('\n');
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Minimal HTML body: bold title, one line per detail, link as an anchor. */
export function html(alert: Alert, opts: { linkText?: string; separator?: string } = {}): string {
	const p = parts(alert);
	const out = [`<b>${escapeHtml(title(alert))}</b>`];
	for (const line of [p.reason, p.target, p.downFor, p.time]) if (line) out.push(escapeHtml(line));
	if (p.link) out.push(`<a href="${escapeHtml(p.link)}">${escapeHtml(opts.linkText ?? p.link)}</a>`);
	return out.join(opts.separator ?? '\n');
}

export function emailHtml(alert: Alert): string {
	const c = color(alert);
	const p = parts(alert);
	const rows = [p.reason, p.target, p.downFor, p.time]
		.filter(Boolean)
		.map((l) => `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`)
		.join('');
	const link = p.link
		? `<p style="margin:14px 0 0"><a href="${escapeHtml(p.link)}" style="color:${c}">Open monitor</a></p>`
		: '';
	return (
		`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:#1f1b16">` +
		`<p style="margin:0 0 10px;font-size:16px;font-weight:600;border-left:4px solid ${c};padding-left:10px">${escapeHtml(title(alert))}</p>` +
		rows +
		link +
		`<p style="margin:18px 0 0;color:#8a8276;font-size:12px">Sent by ${escapeHtml(alert.siteName || 'Bonk')}</p>` +
		`</div>`
	);
}

const COLORS: Record<Tone, string> = {
	down: '#e0461a',
	degraded: '#d99a1e',
	up: '#2f9e44',
	test: '#6d28d9'
};

export function color(alert: Alert): string {
	return COLORS[tone(alert)];
}

export function colorInt(alert: Alert): number {
	return parseInt(color(alert).slice(1), 16);
}

export function severity(alert: Alert): 'critical' | 'warning' | 'info' {
	const t = tone(alert);
	return t === 'down' ? 'critical' : t === 'degraded' ? 'warning' : 'info';
}

export function truncate(s: string, max: number): string {
	return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---- config helpers ----

export function str(config: ProviderConfig, key: string): string {
	const v = config[key];
	return typeof v === 'string' ? v.trim() : '';
}

export function need(config: ProviderConfig, key: string, label: string): string {
	const v = str(config, key);
	if (!v) throw new Error(`${label} is required`);
	return v;
}

export function bool(config: ProviderConfig, key: string): boolean {
	const v = config[key];
	return v === true || v === 'true' || v === 'on' || v === '1';
}

/** Validates an http(s) URL and drops trailing slashes so paths can be appended. */
export function baseUrl(value: string, label: string): string {
	let u: URL;
	try {
		u = new URL(value);
	} catch {
		throw new Error(`${label} is not a valid URL`);
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`${label} must start with https://`);
	return value.replace(/\/+$/, '');
}

export function list(value: string): string[] {
	return value
		.split(/[,;\n]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

// ---- crypto / encoding ----

const enc = new TextEncoder();

export function base64(data: ArrayBuffer | Uint8Array | string): string {
	const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

export function basicAuth(user: string, pass: string): string {
	return `Basic ${base64(`${user}:${pass}`)}`;
}

export async function hmacSha256(key: string, message: string): Promise<ArrayBuffer> {
	const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return crypto.subtle.sign('HMAC', k, enc.encode(message));
}

export function randomId(): string {
	const b = crypto.getRandomValues(new Uint8Array(12));
	return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ---- HTTP ----

export interface PostInit {
	method?: string;
	headers?: Record<string, string>;
}

/** fetch with a 10 s timeout that throws on non-2xx with the status and a snippet of the body. */
export async function request(url: string, init: RequestInit): Promise<Response> {
	const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
	if (!res.ok) {
		const text = (await res.text().catch(() => '')).trim().slice(0, 200);
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ` ${res.statusText}`.trimEnd()}`);
	}
	return res;
}

export function post(url: string, body: unknown, init: PostInit = {}): Promise<Response> {
	return request(url, {
		method: init.method ?? 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json', ...init.headers },
		body: JSON.stringify(body)
	});
}

export function postForm(
	url: string,
	fields: Record<string, string | string[] | undefined>,
	init: PostInit = {}
): Promise<Response> {
	const body = new URLSearchParams();
	for (const [k, v] of Object.entries(fields)) {
		if (v === undefined || v === '') continue;
		for (const item of Array.isArray(v) ? v : [v]) body.append(k, item);
	}
	return request(url, {
		method: init.method ?? 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...init.headers },
		body
	});
}

/** For APIs that answer 200 with an error code in the body (DingTalk, WeCom, Feishu). */
export async function expectCode(res: Response, field: string): Promise<void> {
	const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
	if (!data) return;
	const code = data[field];
	if (code !== undefined && code !== 0) {
		const msg = data.errmsg ?? data.msg ?? data.message ?? '';
		throw new Error(`Error ${String(code)}${msg ? `: ${String(msg)}` : ''}`);
	}
}
