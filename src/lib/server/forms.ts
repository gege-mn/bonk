import { DNS_RECORD_TYPES, parseHeaders, parseHostPort } from './checks';
import { randomToken } from './crypto';
import { parseExpected } from './status';
import type { Monitor, MonitorType } from './types';

export const MONITOR_TYPES: { id: MonitorType; name: string; hint: string }[] = [
	{ id: 'http', name: 'HTTP(s)', hint: 'status + speed' },
	{ id: 'keyword', name: 'Keyword', hint: 'text in body' },
	{ id: 'json', name: 'JSON', hint: 'value at a path' },
	{ id: 'tcp', name: 'TCP port', hint: 'host:port open' },
	{ id: 'dns', name: 'DNS', hint: 'record matches' },
	{ id: 'push', name: 'Push', hint: 'expects a ping' }
];

export const INTERVALS = [60, 120, 300, 600, 900, 1800, 3600];
export const PUSH_INTERVALS = [300, 900, 3600, 21600, 43200, 86400, 604800];

export type MonitorInput = Omit<Monitor, 'id' | 'created_at' | 'push_token'>;

const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? '').trim().slice(0, max);
const bool = (fd: FormData, k: string) => (fd.get(k) === 'on' || fd.get(k) === 'true' ? 1 : 0);
function int(fd: FormData, k: string, min: number, max: number, fallback: number): number {
	const n = Number(String(fd.get(k) ?? '').replace(/[^\d]/g, ''));
	if (!String(fd.get(k) ?? '').trim() || !Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseMonitorForm(fd: FormData): { values: MonitorInput; errors: Record<string, string>; channelIds: number[]; pageIds: number[] } {
	const errors: Record<string, string> = {};
	const type = (MONITOR_TYPES.find((t) => t.id === fd.get('type'))?.id ?? 'http') as MonitorType;
	const target = str(fd, 'target', 500);
	const slowRaw = str(fd, 'slow_ms');

	const values: MonitorInput = {
		name: str(fd, 'name', 80),
		type,
		target: type === 'push' ? '' : target,
		method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(str(fd, 'method')) ? str(fd, 'method') : 'GET',
		headers: str(fd, 'headers', 4000) || '{}',
		body: str(fd, 'body', 8000) || null,
		expected_status: str(fd, 'expected_status', 60) || '2xx',
		follow_redirects: fd.has('follow_redirects_present') ? bool(fd, 'follow_redirects') : 1,
		keyword: str(fd, 'keyword', 200) || null,
		keyword_invert: bool(fd, 'keyword_invert'),
		json_path: str(fd, 'json_path', 200) || null,
		json_expected: str(fd, 'json_expected', 200) || null,
		dns_type: DNS_RECORD_TYPES.includes(str(fd, 'dns_type')) ? str(fd, 'dns_type') : 'A',
		dns_expected: str(fd, 'dns_expected', 200) || null,
		interval_s: int(fd, 'interval_s', 60, 604800, type === 'push' ? 86400 : 60),
		timeout_ms: int(fd, 'timeout_s', 1, 30, 10) * 1000,
		slow_ms: slowRaw ? int(fd, 'slow_ms', 1, 60000, 1500) : null,
		alert_after: int(fd, 'alert_after', 1, 20, 3),
		resend_min: int(fd, 'resend_min', 0, 10080, 0),
		paused: bool(fd, 'paused'),
		public_name: str(fd, 'public_name', 80) || null
	};

	if (!values.name) errors.name = 'Give it a name.';
	if (type === 'http' || type === 'keyword' || type === 'json') {
		try {
			const u = new URL(target);
			if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
		} catch {
			errors.target = 'Enter a full URL starting with https:// or http://';
		}
		try {
			parseExpected(values.expected_status);
		} catch (e) {
			errors.expected_status = (e as Error).message;
		}
		try {
			parseHeaders(values.headers);
		} catch {
			errors.headers = 'Headers must be a JSON object, e.g. {"Authorization": "Bearer …"}';
		}
	}
	if (type === 'keyword' && !values.keyword) errors.keyword = 'Which text should the page contain?';
	if (type === 'json' && !values.json_path) errors.json_path = 'Which value should be checked? e.g. status or data.ok';
	if (type === 'tcp') {
		try {
			parseHostPort(target);
		} catch (e) {
			errors.target = (e as Error).message;
		}
	}
	if (type === 'dns' && !/^[a-z0-9.-]+\.[a-z]{2,}\.?$/i.test(target)) errors.target = 'Enter a hostname, e.g. example.com';

	const channelIds = fd
		.getAll('channels')
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0);
	const pageIds = fd
		.getAll('pages')
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0);
	return { values, errors, channelIds, pageIds };
}

export const newPushToken = () => randomToken(18);

/** Column list shared by insert and update so the two can't drift. */
export const MONITOR_COLUMNS = [
	'name',
	'type',
	'target',
	'method',
	'headers',
	'body',
	'expected_status',
	'follow_redirects',
	'keyword',
	'keyword_invert',
	'json_path',
	'json_expected',
	'dns_type',
	'dns_expected',
	'interval_s',
	'timeout_ms',
	'slow_ms',
	'alert_after',
	'resend_min',
	'paused',
	'public_name'
] as const satisfies readonly (keyof MonitorInput)[];
