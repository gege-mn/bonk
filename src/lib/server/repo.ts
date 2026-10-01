import { emptyState } from './engine';
import { getSetting, normalizeRules, type Rules } from './settings';
import { barStatus, dayStart, decodeRecent, formatPct, hourStart, minBadChecks, uptimePct } from './status';
import type { Incident, IncidentUpdate, Maintenance, Monitor, MonitorState, Status } from './types';

export type Bar = { day: number; n: number; deg: number; down: number; status: ReturnType<typeof barStatus> };

interface DayRow {
	monitor_id: number;
	day: number;
	n: number;
	up: number;
	deg: number;
	down: number;
	lat_sum: number;
	lat_n: number;
}

/** Daily rows plus today's not-yet-flushed hour from the state row. */
function dailyWithLive(rows: DayRow[], states: Map<number, MonitorState>, now: number): Map<number, Map<number, DayRow>> {
	const out = new Map<number, Map<number, DayRow>>();
	for (const r of rows) {
		if (!out.has(r.monitor_id)) out.set(r.monitor_id, new Map());
		out.get(r.monitor_id)!.set(r.day, { ...r });
	}
	for (const s of states.values()) {
		if (!s.h_start || !s.h_n) continue;
		const day = dayStart(s.h_start);
		if (day < dayStart(now) - 90 * 86400) continue;
		if (!out.has(s.monitor_id)) out.set(s.monitor_id, new Map());
		const m = out.get(s.monitor_id)!;
		const cur = m.get(day) ?? { monitor_id: s.monitor_id, day, n: 0, up: 0, deg: 0, down: 0, lat_sum: 0, lat_n: 0 };
		m.set(day, {
			...cur,
			n: cur.n + s.h_n,
			up: cur.up + s.h_up,
			deg: cur.deg + s.h_deg,
			down: cur.down + s.h_down,
			lat_sum: cur.lat_sum + s.h_lat_sum,
			lat_n: cur.lat_n + s.h_lat_n
		});
	}
	return out;
}

/** Push monitors are evaluated every minute whatever their interval says (see `isDue`). */
function minBadFor(m: Pick<Monitor, 'type' | 'interval_s'>, rules: Rules): number {
	return minBadChecks(rules.minIncidentMin, m.type === 'push' ? 60 : m.interval_s);
}

/** Automatic incidents that cleared themselves quickly are noise in the public list; their links still work. */
export function isBlip(i: Pick<Incident, 'auto' | 'started_at' | 'resolved_at'>, rules: Rules): boolean {
	return !!i.auto && i.resolved_at !== null && i.resolved_at - i.started_at < rules.minIncidentMin * 60;
}

function bars(days: Map<number, DayRow> | undefined, count: number, now: number, minBad: number): Bar[] {
	const today = dayStart(now);
	return Array.from({ length: count }, (_, i) => {
		const day = today - (count - 1 - i) * 86400;
		const d = days?.get(day);
		const v = { n: d?.n ?? 0, deg: d?.deg ?? 0, down: d?.down ?? 0 };
		return { day, ...v, status: barStatus(v, minBad) };
	});
}

function totals(days: Map<number, DayRow> | undefined, since: number) {
	let n = 0;
	let down = 0;
	let latSum = 0;
	let latN = 0;
	for (const d of days?.values() ?? []) {
		if (d.day < since) continue;
		n += d.n;
		down += d.down;
		latSum += d.lat_sum;
		latN += d.lat_n;
	}
	return { n, down, uptime: uptimePct(n, down), avgLatency: latN ? Math.round(latSum / latN) : null };
}

async function statesFor(db: D1Database, where = ''): Promise<Map<number, MonitorState>> {
	const { results } = await db.prepare(`SELECT s.* FROM monitor_state s ${where}`).all<MonitorState>();
	return new Map(results.map((s) => [s.monitor_id, s]));
}

export interface PublicMonitor {
	id: number;
	name: string;
	group: string;
	status: Status | 'paused' | 'maintenance';
	uptime: string;
	bars: Bar[];
}

export async function publicStatus(db: D1Database, now = Math.floor(Date.now() / 1000)) {
	const since = dayStart(now) - 89 * 86400;
	const [mons, states, days, open, past, maint, rawRules] = await Promise.all([
		db.prepare('SELECT * FROM monitors WHERE public = 1 ORDER BY sort, id').all<Monitor>(),
		statesFor(db, 'JOIN monitors m ON m.id = s.monitor_id WHERE m.public = 1'),
		db
			.prepare('SELECT d.* FROM daily d JOIN monitors m ON m.id = d.monitor_id WHERE m.public = 1 AND d.day >= ?')
			.bind(since)
			.all<DayRow>(),
		db.prepare('SELECT * FROM incidents WHERE public = 1 AND resolved_at IS NULL ORDER BY started_at DESC').all<Incident>(),
		db
			.prepare('SELECT * FROM incidents WHERE public = 1 AND resolved_at IS NOT NULL AND started_at > ? ORDER BY started_at DESC LIMIT 200')
			.bind(now - 30 * 86400)
			.all<Incident>(),
		db
			.prepare('SELECT * FROM maintenance WHERE ends_at > ? AND starts_at < ? ORDER BY starts_at')
			.bind(now, now + 7 * 86400)
			.all<Maintenance>(),
		getSetting<Rules>(db, 'rules')
	]);
	const rules = normalizeRules(rawRules);
	const byDay = dailyWithLive(days.results, states, now);
	const activeMaint = maint.results.filter((m) => m.starts_at <= now);

	const monitors: PublicMonitor[] = mons.results.map((m) => {
		const s = states.get(m.id);
		const inMaint = activeMaint.some((x) => {
			const ids = JSON.parse(x.monitor_ids || '[]') as number[];
			return ids.length === 0 || ids.includes(m.id);
		});
		return {
			id: m.id,
			name: m.public_name || m.name,
			group: m.group_name,
			status: m.paused ? 'paused' : inMaint ? 'maintenance' : (s?.status ?? 'pending'),
			uptime: formatPct(totals(byDay.get(m.id), since).uptime),
			bars: bars(byDay.get(m.id), 90, now, minBadFor(m, rules))
		};
	});

	const groups: { name: string; monitors: PublicMonitor[] }[] = [];
	for (const m of monitors) {
		let g = groups.find((x) => x.name === m.group);
		if (!g) groups.push((g = { name: m.group, monitors: [] }));
		g.monitors.push(m);
	}

	const updates = await updatesFor(db, open.results.map((i) => i.id));
	return {
		monitors,
		groups,
		openIncidents: open.results.map((i) => ({ ...i, updates: updates.get(i.id) ?? [] })),
		pastIncidents: past.results.filter((i) => !isBlip(i, rules)).slice(0, 10),
		maintenance: maint.results.map((m) => ({ ...m, active: m.starts_at <= now })),
		checkedAt: Math.max(0, ...[...states.values()].map((s) => s.last_check_at ?? 0)) || null
	};
}

export async function updatesFor(db: D1Database, ids: number[]): Promise<Map<number, IncidentUpdate[]>> {
	const out = new Map<number, IncidentUpdate[]>();
	if (!ids.length) return out;
	const { results } = await db
		.prepare(`SELECT * FROM incident_updates WHERE incident_id IN (${ids.map(() => '?').join(',')}) ORDER BY ts DESC`)
		.bind(...ids)
		.all<IncidentUpdate>();
	for (const u of results) {
		if (!out.has(u.incident_id)) out.set(u.incident_id, []);
		out.get(u.incident_id)!.push(u);
	}
	return out;
}

export async function adminMonitors(db: D1Database, now = Math.floor(Date.now() / 1000)) {
	const since = dayStart(now) - 29 * 86400;
	const [mons, states, days] = await Promise.all([
		db.prepare('SELECT * FROM monitors ORDER BY sort, id').all<Monitor>(),
		statesFor(db),
		db.prepare('SELECT * FROM daily WHERE day >= ?').bind(since).all<DayRow>()
	]);
	const byDay = dailyWithLive(days.results, states, now);
	return mons.results.map((m) => {
		const s = states.get(m.id) ?? emptyState(m.id);
		return {
			...m,
			state: s,
			recent: decodeRecent(s.recent).slice(-40),
			uptime30: formatPct(totals(byDay.get(m.id), since).uptime)
		};
	});
}

export async function monitorDetail(db: D1Database, id: number, now = Math.floor(Date.now() / 1000)) {
	const m = await db.prepare('SELECT * FROM monitors WHERE id = ?').bind(id).first<Monitor>();
	if (!m) return null;
	const [stateRow, hourly, days, events, links] = await Promise.all([
		db.prepare('SELECT * FROM monitor_state WHERE monitor_id = ?').bind(id).first<MonitorState>(),
		db
			.prepare('SELECT hour, n, up, deg, down, lat_sum, lat_n, lat_max FROM hourly WHERE monitor_id = ? AND hour >= ? ORDER BY hour')
			.bind(id, hourStart(now) - 7 * 86400)
			.all<{ hour: number; n: number; up: number; deg: number; down: number; lat_sum: number; lat_n: number; lat_max: number }>(),
		db
			.prepare('SELECT * FROM daily WHERE monitor_id = ? AND day >= ?')
			.bind(id, dayStart(now) - 89 * 86400)
			.all<DayRow>(),
		db
			.prepare('SELECT ts, kind, message FROM events WHERE monitor_id = ? ORDER BY ts DESC LIMIT 40')
			.bind(id)
			.all<{ ts: number; kind: string; message: string }>(),
		db.prepare('SELECT channel_id FROM monitor_channels WHERE monitor_id = ?').bind(id).all<{ channel_id: number }>()
	]);
	const state = stateRow ?? emptyState(id);
	const byDay = dailyWithLive(days.results, new Map([[id, state]]), now).get(id);

	const hours = [...hourly.results];
	if (state.h_start && state.h_n) {
		hours.push({
			hour: state.h_start,
			n: state.h_n,
			up: state.h_up,
			deg: state.h_deg,
			down: state.h_down,
			lat_sum: state.h_lat_sum,
			lat_n: state.h_lat_n,
			lat_max: state.h_lat_max
		});
	}
	const today = dayStart(now);
	return {
		monitor: m,
		state,
		recent: decodeRecent(state.recent),
		hours: hours.map((h) => ({ ts: h.hour, avg: h.lat_n ? Math.round(h.lat_sum / h.lat_n) : null, max: h.lat_max, n: h.n, down: h.down })),
		days: [...(byDay?.values() ?? [])]
			.sort((a, b) => a.day - b.day)
			.map((d) => ({ ts: d.day, avg: d.lat_n ? Math.round(d.lat_sum / d.lat_n) : null, n: d.n, down: d.down })),
		bars: bars(byDay, 90, now, 1),
		uptime24: formatPct(
			uptimePct(
				hours.filter((h) => h.hour >= hourStart(now) - 23 * 3600).reduce((a, h) => a + h.n, 0),
				hours.filter((h) => h.hour >= hourStart(now) - 23 * 3600).reduce((a, h) => a + h.down, 0)
			)
		),
		uptime30: formatPct(totals(byDay, today - 29 * 86400).uptime),
		uptime90: formatPct(totals(byDay, today - 89 * 86400).uptime),
		avg24: (() => {
			const hs = hours.filter((h) => h.hour >= hourStart(now) - 23 * 3600);
			const n = hs.reduce((a, h) => a + h.lat_n, 0);
			return n ? Math.round(hs.reduce((a, h) => a + h.lat_sum, 0) / n) : null;
		})(),
		events: events.results,
		channelIds: links.results.map((l) => l.channel_id)
	};
}
