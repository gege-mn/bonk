import type { CheckResult, MonitorState, Status } from './types';

export const RECENT_MAX = 90;

/** "2xx", "200-299", "200,301", "2xx,3xx" → matcher. Empty means 2xx. */
export function parseExpected(spec: string): (code: number) => boolean {
	const parts = (spec || '2xx')
		.split(',')
		.map((p) => p.trim().toLowerCase())
		.filter(Boolean);
	const tests = parts.map((p): ((c: number) => boolean) => {
		const cls = /^([1-5])xx$/.exec(p);
		if (cls) return (c) => Math.floor(c / 100) === Number(cls[1]);
		const range = /^(\d{3})\s*-\s*(\d{3})$/.exec(p);
		if (range) return (c) => c >= Number(range[1]) && c <= Number(range[2]);
		if (/^\d{3}$/.test(p)) return (c) => c === Number(p);
		throw new Error(`Can't read expected status "${p}". Use 2xx, 200-299 or 200,301.`);
	});
	return (code) => tests.some((t) => t(code));
}

export interface RecentCheck {
	ts: number;
	result: CheckResult;
	latency: number | null;
}

const CODE: Record<CheckResult, string> = { up: 'u', degraded: 'd', down: 'x' };
const DECODE: Record<string, CheckResult> = { u: 'up', d: 'degraded', x: 'down' };

export function decodeRecent(s: string): RecentCheck[] {
	if (!s) return [];
	return s.split(';').flatMap((part) => {
		const [ts, r, lat] = part.split(':');
		const result = DECODE[r];
		if (!result) return [];
		return [{ ts: Number(ts), result, latency: lat === '' || lat === undefined ? null : Number(lat) }];
	});
}

export function appendRecent(s: string, c: RecentCheck): string {
	const item = `${c.ts}:${CODE[c.result]}:${c.latency ?? ''}`;
	const list = s ? s.split(';') : [];
	list.push(item);
	return list.slice(-RECENT_MAX).join(';');
}

export interface Transition {
	from: Status;
	to: CheckResult;
}

/**
 * Applies one raw check result. Failures only become the confirmed status after
 * `alertAfter` in a row; a single success recovers immediately.
 */
export function applyResult(
	state: Pick<MonitorState, 'status' | 'since' | 'streak_status' | 'streak'>,
	result: CheckResult,
	alertAfter: number,
	now: number
): { status: Status; since: number | null; streak_status: CheckResult; streak: number; transition: Transition | null } {
	const streak = state.streak_status === result ? state.streak + 1 : 1;
	let status: Status = state.status;
	if (result === 'up') status = 'up';
	else if (streak >= Math.max(1, alertAfter)) status = result;
	else if (state.status === 'pending') status = 'pending';

	const changed = status !== state.status;
	const transition: Transition | null =
		changed && status !== 'pending' ? { from: state.status, to: status as CheckResult } : null;
	return {
		status,
		since: changed ? now : (state.since ?? now),
		streak_status: result,
		streak,
		transition
	};
}

/** First-ever success isn't news; everything else that changes the status is. */
export function shouldAlert(t: Transition): boolean {
	return !(t.from === 'pending' && t.to === 'up');
}

export const hourStart = (ts: number) => ts - (ts % 3600);
export const dayStart = (ts: number) => ts - (ts % 86400);

export function uptimePct(n: number, down: number): number | null {
	if (!n) return null;
	return ((n - down) / n) * 100;
}

export function formatPct(p: number | null): string {
	if (p === null) return '—';
	if (p >= 99.995) return '100%';
	return `${(Math.floor(p * 100) / 100).toFixed(2)}%`;
}

/** A day with a stray failed check reads as degraded, not down, so the bars aren't all alarm. */
export function barStatus(d: { n: number; deg: number; down: number }): 'up' | 'degraded' | 'down' | 'none' {
	if (!d.n) return 'none';
	if (d.down / d.n >= 0.01) return 'down';
	if (d.down > 0 || d.deg / d.n >= 0.01) return 'degraded';
	return 'up';
}
