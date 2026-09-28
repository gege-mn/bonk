import { error, fail, redirect } from '@sveltejs/kit';
import { tick } from '$lib/server/engine';
import { monitorDetail } from '$lib/server/repo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params, url }) => {
	const now = Math.floor(Date.now() / 1000);
	const d = await monitorDetail(platform!.env.DB, Number(params.id), now);
	if (!d) error(404, 'No such monitor');
	const range = ['1h', '24h', '7d', '30d'].includes(url.searchParams.get('range') ?? '') ? url.searchParams.get('range')! : '24h';
	const channels = await platform!.env.DB.prepare('SELECT id, name, provider FROM channels').all<{ id: number; name: string; provider: string }>();
	return {
		...d,
		range,
		now,
		origin: url.origin,
		channels: channels.results.filter((c) => d.channelIds.includes(c.id))
	};
};

export const actions: Actions = {
	check: async ({ platform, params }) => {
		await tick(platform!.env, Math.floor(Date.now() / 1000), { onlyId: Number(params.id) });
		return { checked: true };
	},
	pause: async ({ platform, params }) => {
		const db = platform!.env.DB;
		const id = Number(params.id);
		const now = Math.floor(Date.now() / 1000);
		const open = await db
			.prepare('SELECT incident_id AS id FROM monitor_state WHERE monitor_id = ? AND incident_id IS NOT NULL')
			.bind(id)
			.first<{ id: number }>();
		await db.batch([
			db.prepare('UPDATE monitors SET paused = 1 - paused WHERE id = ?').bind(id),
			// A paused monitor can't recover by itself, so don't leave its outage open on the status page.
			...(open
				? [
						db
							.prepare("UPDATE incidents SET status = 'resolved', resolved_at = coalesce(resolved_at, ?) WHERE id = ? AND resolved_at IS NULL")
							.bind(now, open.id),
						db
							.prepare("INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, 'resolved', 'Monitoring paused.')")
							.bind(open.id, now),
						db.prepare('UPDATE monitor_state SET incident_id = NULL WHERE monitor_id = ?').bind(id)
					]
				: [])
		]);
		return { paused: true };
	},
	delete: async ({ platform, params, request }) => {
		const fd = await request.formData();
		if (fd.get('confirm') !== 'yes') return fail(400, { deleteError: 'Tick the box to confirm.' });
		const db = platform!.env.DB;
		const id = Number(params.id);
		await db.batch([
			db.prepare('UPDATE incidents SET resolved_at = coalesce(resolved_at, unixepoch()), status = \'resolved\' WHERE monitor_id = ?').bind(id),
			db.prepare('DELETE FROM monitors WHERE id = ?').bind(id)
		]);
		redirect(303, '/admin');
	}
};
