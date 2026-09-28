const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

// All times render in UTC so server and browser output match (no hydration drift).
export function fmtTime(ts: number): string {
	const d = new Date(ts * 1000);
	return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function fmtDate(ts: number, withYear = true): string {
	const d = new Date(ts * 1000);
	return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}${withYear ? `, ${d.getUTCFullYear()}` : ''}`;
}

export function fmtWhen(ts: number, now: number): string {
	const sameDay = Math.floor(ts / 86400) === Math.floor(now / 86400);
	return sameDay ? `${fmtTime(ts).replace(' UTC', '')} today` : `${fmtDate(ts, false)} ${fmtTime(ts).replace(' UTC', '')}`;
}

export function fmtDuration(s: number): string {
	if (s < 90) return `${Math.max(0, Math.round(s))} s`;
	if (s < 5400) return `${Math.round(s / 60)} min`;
	if (s < 172800) return `${Math.round(s / 3600)} h`;
	return `${Math.round(s / 86400)} days`;
}

export const fmtMs = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : `${ms.toLocaleString('en-US')} ms`);

export function fmtInterval(s: number): string {
	if (s % 3600 === 0) return s === 3600 ? 'hour' : `${s / 3600} h`;
	if (s % 60 === 0) return s === 60 ? 'minute' : `${s / 60} min`;
	return `${s} s`;
}

export const STATUS_LABEL: Record<string, string> = {
	up: 'Operational',
	degraded: 'Degraded',
	down: 'Down',
	pending: 'Waiting for first check',
	paused: 'Paused',
	maintenance: 'Maintenance'
};
