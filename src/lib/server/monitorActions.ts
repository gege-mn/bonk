import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { runCheck } from './checks';
import { MONITOR_COLUMNS, newPushToken, parseMonitorForm } from './forms';
import { setMonitorPagesStmts } from './pages';
import type { Monitor } from './types';

export async function testAction({ request }: RequestEvent) {
	const fd = await request.formData();
	const { values, errors } = parseMonitorForm(fd);
	if (errors.target) return fail(400, { test: null, testError: errors.target, values });
	if (values.type === 'push') return { test: null, testError: 'Push monitors are tested by sending a ping to their URL.', values };
	const m = { ...values, id: 0, created_at: 0, push_token: null } as Monitor;
	const out = await runCheck(m, null);
	return { test: { ...out, ranAt: Math.floor(Date.now() / 1000) }, testError: null, values };
}

export async function saveMonitor(event: RequestEvent, id: number | null) {
	const db = event.platform!.env.DB;
	const fd = await event.request.formData();
	const { values, errors, channelIds, pageIds } = parseMonitorForm(fd);
	if (Object.keys(errors).length) return fail(400, { errors, values, channelIds, pageIds });

	const cols = MONITOR_COLUMNS;
	const vals = cols.map((c) => values[c]);
	let monitorId = id;
	if (id === null) {
		const row = await db
			.prepare(
				`INSERT INTO monitors (${cols.join(', ')}, push_token, created_at) VALUES (${cols.map(() => '?').join(', ')}, ?, ?) RETURNING id`
			)
			.bind(...vals, values.type === 'push' ? newPushToken() : null, Math.floor(Date.now() / 1000))
			.first<{ id: number }>();
		monitorId = row!.id;
	} else {
		const before = await db.prepare('SELECT type FROM monitors WHERE id = ?').bind(id).first<{ type: string }>();
		if (values.type === 'push' && before && before.type !== 'push') {
			// Start the ping clock now, or it would count from creation and alert at once.
			await db
				.prepare('INSERT INTO monitor_state (monitor_id, last_push_at) VALUES (?1, ?2) ON CONFLICT (monitor_id) DO UPDATE SET last_push_at = ?2')
				.bind(id, Math.floor(Date.now() / 1000))
				.run();
		}
		await db
			.prepare(
				`UPDATE monitors SET ${cols.map((c) => `${c} = ?`).join(', ')},
				push_token = CASE WHEN ? = 'push' THEN coalesce(push_token, ?) ELSE push_token END WHERE id = ?`
			)
			.bind(...vals, values.type, newPushToken(), id)
			.run();
	}
	const valid = await db.prepare('SELECT id FROM channels').all<{ id: number }>();
	const ids = channelIds.filter((c) => valid.results.some((v) => v.id === c));
	await db.batch([
		db.prepare('DELETE FROM monitor_channels WHERE monitor_id = ?').bind(monitorId),
		...ids.map((c) => db.prepare('INSERT INTO monitor_channels (monitor_id, channel_id) VALUES (?, ?)').bind(monitorId, c)),
		// Its incidents go wherever it goes, so leaving a page also takes its history off that page.
		...setMonitorPagesStmts(db, monitorId!, pageIds)
	]);
	redirect(303, `/admin/monitors/${monitorId}`);
}

export async function formContext(db: D1Database) {
	const [channels, pages] = await Promise.all([
		db.prepare('SELECT id, name, provider, default_on FROM channels ORDER BY name').all<{ id: number; name: string; provider: string; default_on: number }>(),
		db
			.prepare('SELECT id, name, public, is_default FROM pages ORDER BY is_default DESC, name COLLATE NOCASE, id')
			.all<{ id: number; name: string; public: number; is_default: number }>()
	]);
	return { channels: channels.results, pages: pages.results };
}
