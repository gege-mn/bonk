import { runCheck, fmtDuration, type CheckOutcome } from './checks';
import { isSealed, open } from './crypto';
import { sendAlert } from './notify';
import type { Alert } from './notify/types';
import { getSetting, normalizeSite, type Site } from './settings';
import { appendRecent, applyResult, dayStart, decodeRecent, hourStart, shouldAlert, tallyResult, unconfirmedByHour } from './status';
import type { BonkEnv, Channel, CheckResult, Maintenance, Monitor, MonitorState } from './types';

type Row = Monitor & Partial<Omit<MonitorState, 'monitor_id'>>;

const MAX_ATTEMPTS = 6;

export function emptyState(id: number): MonitorState {
	return {
		monitor_id: id,
		status: 'pending',
		since: null,
		streak_status: null,
		streak: 0,
		last_check_at: null,
		last_latency: null,
		last_message: null,
		last_push_at: null,
		last_notified_at: null,
		incident_id: null,
		recent: '',
		h_start: null,
		h_n: 0,
		h_up: 0,
		h_deg: 0,
		h_down: 0,
		h_lat_sum: 0,
		h_lat_n: 0,
		h_lat_max: 0
	};
}

function stateOf(r: Row): MonitorState {
	const s = emptyState(r.id);
	for (const k of Object.keys(s) as (keyof MonitorState)[]) {
		if (k !== 'monitor_id' && r[k as keyof Row] !== undefined && r[k as keyof Row] !== null) {
			(s as unknown as Record<string, unknown>)[k] = r[k as keyof Row];
		}
	}
	return s;
}

export function activeMaintenance(list: Maintenance[], monitorId: number, now: number): Maintenance | undefined {
	return list.find((m) => {
		if (now < m.starts_at || now >= m.ends_at) return false;
		const ids = safeIds(m.monitor_ids);
		return ids.length === 0 || ids.includes(monitorId);
	});
}

function safeIds(json: string): number[] {
	try {
		const v = JSON.parse(json);
		return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
	} catch {
		return [];
	}
}

export async function channelConfig(ch: Channel, key: string | undefined): Promise<Record<string, string | boolean>> {
	const raw = JSON.parse(ch.config || '{}') as Record<string, string | boolean>;
	const out: Record<string, string | boolean> = {};
	for (const [k, v] of Object.entries(raw)) out[k] = isSealed(v) ? await open(v as string, key) : v;
	return out;
}

const upsertState = `INSERT INTO monitor_state (monitor_id, status, since, streak_status, streak, last_check_at, last_latency,
	last_message, last_notified_at, incident_id, recent, h_start, h_n, h_up, h_deg, h_down, h_lat_sum, h_lat_n, h_lat_max)
	VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
	ON CONFLICT (monitor_id) DO UPDATE SET status = ?2, since = ?3, streak_status = ?4, streak = ?5, last_check_at = ?6,
	last_latency = ?7, last_message = ?8, last_notified_at = ?9, incident_id = ?10, recent = ?11, h_start = ?12, h_n = ?13,
	h_up = ?14, h_deg = ?15, h_down = ?16, h_lat_sum = ?17, h_lat_n = ?18, h_lat_max = ?19`;

function flushHourStmts(db: D1Database, s: MonitorState): D1PreparedStatement[] {
	if (s.h_start === null || s.h_n === 0) return [];
	return [
		db
			.prepare(
				`INSERT INTO hourly (monitor_id, hour, n, up, deg, down, lat_sum, lat_n, lat_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (monitor_id, hour) DO UPDATE SET n = n + excluded.n, up = up + excluded.up, deg = deg + excluded.deg,
				down = down + excluded.down, lat_sum = lat_sum + excluded.lat_sum, lat_n = lat_n + excluded.lat_n,
				lat_max = max(lat_max, excluded.lat_max)`
			)
			.bind(s.monitor_id, s.h_start, s.h_n, s.h_up, s.h_deg, s.h_down, s.h_lat_sum, s.h_lat_n, s.h_lat_max),
		db
			.prepare(
				`INSERT INTO daily (monitor_id, day, n, up, deg, down, lat_sum, lat_n) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (monitor_id, day) DO UPDATE SET n = n + excluded.n, up = up + excluded.up, deg = deg + excluded.deg,
				down = down + excluded.down, lat_sum = lat_sum + excluded.lat_sum, lat_n = lat_n + excluded.lat_n`
			)
			.bind(s.monitor_id, dayStart(s.h_start), s.h_n, s.h_up, s.h_deg, s.h_down, s.h_lat_sum, s.h_lat_n)
	];
}

/** Folds one result into the state row's running hour, flushing the previous hour first. */
export function accumulate(db: D1Database, s: MonitorState, result: CheckResult, latency: number | null, now: number) {
	const stmts: D1PreparedStatement[] = [];
	const hs = hourStart(now);
	if (s.h_start !== hs) {
		stmts.push(...flushHourStmts(db, s));
		Object.assign(s, { h_start: hs, h_n: 0, h_up: 0, h_deg: 0, h_down: 0, h_lat_sum: 0, h_lat_n: 0, h_lat_max: 0 });
	}
	s.h_n++;
	if (result === 'up') s.h_up++;
	else if (result === 'degraded') s.h_deg++;
	else s.h_down++;
	if (latency !== null) {
		s.h_lat_sum += latency;
		s.h_lat_n++;
		s.h_lat_max = Math.max(s.h_lat_max, latency);
	}
	return stmts;
}

/**
 * On confirmation, moves the `count` checks before this one from up to `to`. Call after
 * `accumulate`: the running hour is fixed in place, already-flushed hours with statements.
 */
export function recountUnconfirmed(db: D1Database, s: MonitorState, prevRecent: string, count: number, to: 'degraded' | 'down') {
	const stmts: D1PreparedStatement[] = [];
	const col = to === 'down' ? 'down' : 'deg';
	for (const [hour, k] of unconfirmedByHour(decodeRecent(prevRecent), count)) {
		if (hour === s.h_start) {
			const moved = Math.min(k, s.h_up);
			s.h_up -= moved;
			if (to === 'down') s.h_down += moved;
			else s.h_deg += moved;
			continue;
		}
		stmts.push(
			db
				.prepare(`UPDATE hourly SET up = up - ?1, ${col} = ${col} + ?1 WHERE monitor_id = ?2 AND hour = ?3 AND up >= ?1`)
				.bind(k, s.monitor_id, hour),
			db
				.prepare(`UPDATE daily SET up = up - ?1, ${col} = ${col} + ?1 WHERE monitor_id = ?2 AND day = ?3 AND up >= ?1`)
				.bind(k, s.monitor_id, dayStart(hour))
		);
	}
	return stmts;
}

export function saveStateStmt(db: D1Database, s: MonitorState) {
	return db
		.prepare(upsertState)
		.bind(
			s.monitor_id,
			s.status,
			s.since,
			s.streak_status,
			s.streak,
			s.last_check_at,
			s.last_latency,
			s.last_message,
			s.last_notified_at,
			s.incident_id,
			s.recent,
			s.h_start,
			s.h_n,
			s.h_up,
			s.h_deg,
			s.h_down,
			s.h_lat_sum,
			s.h_lat_n,
			s.h_lat_max
		);
}

interface Pending {
	alert: Alert;
	channelIds: number[];
}

export function isDue(r: Row, now: number): boolean {
	if (r.last_check_at === null || r.last_check_at === undefined) return true;
	// Push monitors are cheap (no network) and must notice a missed ping promptly.
	const every = r.type === 'push' ? 60 : r.interval_s;
	// Cron fires on the minute but not exactly; don't let a few seconds of jitter skip a slot.
	return now - r.last_check_at >= every - 10;
}

export async function tick(
	env: BonkEnv,
	now = Math.floor(Date.now() / 1000),
	opts: { onlyId?: number } = {}
): Promise<{ checked: number; alerts: number }> {
	const db = env.DB;
	const [monRes, maintRes, linkRes, chanRes] = await db.batch([
		db.prepare(
			`SELECT m.*, s.status, s.since, s.streak_status, s.streak, s.last_check_at, s.last_latency, s.last_message,
			s.last_push_at, s.last_notified_at, s.incident_id, s.recent, s.h_start, s.h_n, s.h_up, s.h_deg, s.h_down,
			s.h_lat_sum, s.h_lat_n, s.h_lat_max
			FROM monitors m LEFT JOIN monitor_state s ON s.monitor_id = m.id WHERE m.paused = 0`
		),
		db.prepare('SELECT * FROM maintenance WHERE ends_at > ?1 AND starts_at <= ?1').bind(now),
		db.prepare('SELECT monitor_id, channel_id FROM monitor_channels'),
		db.prepare('SELECT * FROM channels')
	]);
	const rows = monRes.results as unknown as Row[];
	const maint = maintRes.results as unknown as Maintenance[];
	const links = linkRes.results as unknown as { monitor_id: number; channel_id: number }[];
	const channels = new Map((chanRes.results as unknown as Channel[]).map((c) => [c.id, c]));
	const site = normalizeSite(await getSetting<Site>(db, 'site'));

	const due = opts.onlyId ? rows.filter((r) => r.id === opts.onlyId) : rows.filter((r) => isDue(r, now));
	const outcomes = await Promise.all(
		due.map(async (r) => [r, await runCheck(r, stateOf(r), now)] as [Row, CheckOutcome])
	);

	const writes: D1PreparedStatement[] = [];
	const pending: Pending[] = [];

	for (const [row, out] of outcomes) {
		if (out.skip) continue;
		const s = stateOf(row);
		const prev = { ...s };
		const next = applyResult(s, out.result, row.alert_after, now);
		Object.assign(s, {
			status: next.status,
			since: next.since,
			streak_status: next.streak_status,
			streak: next.streak,
			last_check_at: now,
			last_latency: out.latency,
			last_message: out.message,
			recent: appendRecent(s.recent, { ts: now, result: out.result, latency: out.latency })
		});
		writes.push(...accumulate(db, s, tallyResult(next.status, out.result), out.latency, now));
		const confirmed = next.transition && next.transition.to !== 'up' ? next.transition : null;
		// Trouble began with the first failed check of the streak, not when it was confirmed.
		let troubleSince = now;
		if (confirmed && (confirmed.from === 'up' || confirmed.from === 'pending')) {
			writes.push(...recountUnconfirmed(db, s, prev.recent, next.streak - 1, confirmed.to as 'degraded' | 'down'));
			if (next.streak > 1) troubleSince = decodeRecent(prev.recent).slice(1 - next.streak)[0]?.ts ?? now;
		}

		const inMaintenance = activeMaintenance(maint, row.id, now);
		const channelIds = links.filter((l) => l.monitor_id === row.id && channels.has(l.channel_id)).map((l) => l.channel_id);
		const base = {
			monitor: { id: row.id, name: row.name, target: row.type === 'push' ? 'push' : row.target },
			at: now,
			siteName: site.name,
			link: site.url ? `${site.url}/admin/monitors/${row.id}` : undefined
		};

		if (next.transition) {
			const t = next.transition;
			writes.push(
				db
					.prepare('INSERT INTO events (monitor_id, ts, kind, message) VALUES (?, ?, ?, ?)')
					.bind(row.id, now, t.to, t.from === 'pending' && t.to === 'up' ? 'First check passed' : out.message)
			);
			// Recoveries always close their incident; only opening one is muted by maintenance.
			if (!inMaintenance || t.to === 'up') await syncIncident(db, row, s, t.to, prev.since, now, out.message, troubleSince);
			if (shouldAlert(t) && !inMaintenance) {
				pending.push({
					alert: {
						...base,
						kind: t.to,
						from: t.from,
						to: t.to,
						reason: out.message,
						downFor: t.to === 'up' && prev.since ? now - prev.since : undefined
					},
					channelIds
				});
				s.last_notified_at = now;
			}
		} else if (
			(s.status === 'down' || s.status === 'degraded') &&
			!inMaintenance &&
			(s.last_notified_at ?? 0) < (s.since ?? 0)
		) {
			// Went down during maintenance and is still down after it: announce it now.
			await syncIncident(db, row, s, s.status, prev.since, now, out.message);
			pending.push({
				alert: { ...base, kind: s.status, from: 'up', to: s.status, reason: out.message },
				channelIds
			});
			s.last_notified_at = now;
		} else if (
			(s.status === 'down' || s.status === 'degraded') &&
			row.resend_min > 0 &&
			!inMaintenance &&
			now - (s.last_notified_at ?? s.since ?? now) >= row.resend_min * 60
		) {
			pending.push({
				alert: { ...base, kind: 'reminder', from: s.status, to: s.status, reason: `${out.message} · for ${fmtDuration(now - (s.since ?? now))}` },
				channelIds
			});
			s.last_notified_at = now;
		}
		writes.push(saveStateStmt(db, s));
	}

	await safeBatch(db, writes);

	const notes = await Promise.all(
		pending.flatMap((p) => p.channelIds.map((id) => deliver(env, channels.get(id)!, p.alert, now)))
	);
	const followUps = notes.flat();
	if (!opts.onlyId) {
		followUps.push(...(await drainQueue(env, channels, now)));
		if (now % 3600 < 60) followUps.push(...housekeeping(db, now));
	}
	await safeBatch(db, followUps);

	return { checked: outcomes.length, alerts: pending.length };
}

/**
 * A batch is one transaction, so a monitor deleted mid-tick (foreign key failure)
 * would drop every other monitor's result too. Fall back to one-by-one.
 */
async function safeBatch(db: D1Database, stmts: D1PreparedStatement[]) {
	if (!stmts.length) return;
	try {
		await db.batch(stmts);
	} catch (e) {
		console.warn('batch failed, retrying individually', e);
		for (const st of stmts) await st.run().catch((err) => console.warn('statement failed', err));
	}
}

/** Check output can echo response bodies or internal hostnames; incidents show on status pages. */
export function publicReason(msg: string): string {
	if (/^(HTTP \d{3}|Timed out|Port \d+|No ping|Resolver returned|DNS [A-Z]+$|No [A-Z]+ records$)/.test(msg) || /slow above/.test(msg)) {
		return msg;
	}
	return 'the health check failed';
}

/** Title of an automatic incident. Status pages rebuild it with their own name for the monitor. */
export const autoTitle = (label: string, severity: string) => (severity === 'down' ? `${label} is down` : `${label} is responding slowly`);

async function syncIncident(...args: Parameters<typeof openOrCloseIncident>) {
	try {
		await openOrCloseIncident(...args);
	} catch (e) {
		// A monitor or incident deleted mid-tick must not sink every other monitor's result.
		console.warn('incident sync failed', e);
	}
}

async function openOrCloseIncident(
	db: D1Database,
	m: Monitor,
	s: MonitorState,
	to: CheckResult,
	prevSince: number | null,
	now: number,
	rawReason: string,
	startedAt = now
) {
	const reason = publicReason(rawReason);
	if (to === 'up') {
		if (!s.incident_id) return;
		const dur = prevSince ? ` after ${fmtDuration(now - prevSince)}` : '';
		await db.batch([
			db
				.prepare("UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE id = ? AND resolved_at IS NULL")
				.bind(now, s.incident_id),
			db
				.prepare("INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, 'resolved', ?)")
				.bind(s.incident_id, now, `Recovered automatically${dur}.`)
		]);
		s.incident_id = null;
		return;
	}
	const title = autoTitle(m.public_name || m.name, to);
	if (s.incident_id) {
		await db.batch([
			db
				.prepare('UPDATE incidents SET severity = ?, title = CASE WHEN auto = 1 THEN ? ELSE title END WHERE id = ?')
				.bind(to, title, s.incident_id),
			db
				.prepare("INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, 'investigating', ?)")
				.bind(s.incident_id, now, `Now ${to === 'down' ? 'down' : 'degraded'}: ${reason}.`)
		]);
		return;
	}
	const inc = await db
		.prepare(
			"INSERT INTO incidents (monitor_id, title, severity, status, auto, public, started_at) VALUES (?, ?, ?, 'investigating', 1, 1, ?) RETURNING id"
		)
		.bind(m.id, title, to, startedAt)
		.first<{ id: number }>();
	if (!inc) return;
	s.incident_id = inc.id;
	await db
		.prepare("INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, 'investigating', ?)")
		.bind(inc.id, now, `Detected automatically after ${m.alert_after} failed check${m.alert_after === 1 ? '' : 's'} in a row: ${reason}.`)
		.run();
}

/** Sends now; on failure returns statements that queue a retry. */
export async function deliver(env: BonkEnv, ch: Channel, alert: Alert, now: number): Promise<D1PreparedStatement[]> {
	const db = env.DB;
	try {
		await sendAlert(ch.provider, await channelConfig(ch, env.ENCRYPTION_KEY), alert);
		return [
			db
				.prepare("INSERT INTO events (monitor_id, ts, kind, message) VALUES (?, ?, 'notified', ?)")
				.bind(alert.monitor.id || null, now, `${ch.name} (${ch.provider})`)
		];
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return [
			db
				.prepare('INSERT INTO notify_queue (channel_id, monitor_id, alert, attempts, next_at, last_error) VALUES (?, ?, ?, 1, ?, ?)')
				.bind(ch.id, alert.monitor.id || null, JSON.stringify(alert), now + 60, msg.slice(0, 500)),
			db
				.prepare("INSERT INTO events (monitor_id, ts, kind, message) VALUES (?, ?, 'notify_failed', ?)")
				.bind(alert.monitor.id || null, now, `${ch.name}: ${msg.slice(0, 300)} — will retry`)
		];
	}
}

async function drainQueue(env: BonkEnv, channels: Map<number, Channel>, now: number): Promise<D1PreparedStatement[]> {
	const db = env.DB;
	const { results } = await db
		.prepare('SELECT * FROM notify_queue WHERE next_at <= ? ORDER BY next_at LIMIT 10')
		.bind(now)
		.all<{ id: number; channel_id: number; monitor_id: number | null; alert: string; attempts: number }>();
	const out: D1PreparedStatement[] = [];
	await Promise.all(
		results.map(async (q) => {
			const ch = channels.get(q.channel_id);
			if (!ch) {
				out.push(db.prepare('DELETE FROM notify_queue WHERE id = ?').bind(q.id));
				return;
			}
			try {
				await sendAlert(ch.provider, await channelConfig(ch, env.ENCRYPTION_KEY), JSON.parse(q.alert) as Alert);
				out.push(
					db.prepare('DELETE FROM notify_queue WHERE id = ?').bind(q.id),
					db
						.prepare("INSERT INTO events (monitor_id, ts, kind, message) VALUES (?, ?, 'notified', ?)")
						.bind(q.monitor_id, now, `${ch.name} (${ch.provider}, retry ${q.attempts})`)
				);
			} catch (e) {
				const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
				if (q.attempts + 1 >= MAX_ATTEMPTS) {
					out.push(
						db.prepare('DELETE FROM notify_queue WHERE id = ?').bind(q.id),
						db
							.prepare("INSERT INTO events (monitor_id, ts, kind, message) VALUES (?, ?, 'notify_failed', ?)")
							.bind(q.monitor_id, now, `${ch.name}: gave up after ${MAX_ATTEMPTS} attempts — ${msg}`)
					);
				} else {
					out.push(
						db
							.prepare('UPDATE notify_queue SET attempts = attempts + 1, next_at = ?, last_error = ? WHERE id = ?')
							.bind(now + 60 * 2 ** q.attempts, msg, q.id)
					);
				}
			}
		})
	);
	return out;
}

function housekeeping(db: D1Database, now: number): D1PreparedStatement[] {
	return [
		db.prepare('DELETE FROM hourly WHERE hour < ?').bind(now - 35 * 86400),
		db.prepare('DELETE FROM daily WHERE day < ?').bind(now - 400 * 86400),
		db.prepare('DELETE FROM events WHERE ts < ?').bind(now - 90 * 86400),
		db.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(now - 86400)
	];
}
