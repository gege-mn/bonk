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

/**
 * What a raw result adds to the uptime totals. Failures only count once the monitor is
 * confirmed down/degraded, so a blip shorter than `alert_after` checks never shows in history.
 */
export function tallyResult(status: Status, result: CheckResult): CheckResult {
	return status === 'down' || status === 'degraded' ? result : 'up';
}

/**
 * The failures that led up to a confirmation were tallied as up while still unconfirmed.
 * Returns how many of them fall in each hour so the totals can be corrected.
 */
export function unconfirmedByHour(recent: RecentCheck[], count: number): Map<number, number> {
	const out = new Map<number, number>();
	if (count <= 0) return out;
	for (const c of recent.slice(-count)) out.set(hourStart(c.ts), (out.get(hourStart(c.ts)) ?? 0) + 1);
	return out;
}

/** How many failed checks add up to `minutes` of trouble at this check interval; never less than one. */
export function minBadChecks(minutes: number, intervalS: number): number {
	return Math.max(1, Math.ceil((minutes * 60) / Math.max(1, intervalS)));
}

/**
 * A day only changes color once its failed and slow checks add up to `minBad`, so a short
 * confirmed outage stays green. Past that, under 1% down reads as degraded, not down.
 */
export function barStatus(d: { n: number; deg: number; down: number }, minBad = 1): 'up' | 'degraded' | 'down' | 'none' {
	if (!d.n) return 'none';
	if (d.down + d.deg < minBad) return 'up';
	return d.down / d.n >= 0.01 ? 'down' : 'degraded';
}
