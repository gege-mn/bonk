import { error, fail, redirect } from '@sveltejs/kit';
import { updatesFor } from '$lib/server/repo';
import type { Incident } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

export const load: PageServerLoad = async ({ platform, params }) => {
	const db = platform!.env.DB;
	const inc = await db.prepare('SELECT * FROM incidents WHERE id = ?').bind(Number(params.id)).first<Incident>();
	if (!inc) error(404, 'No such incident');
	return { incident: inc, updates: (await updatesFor(db, [inc.id])).get(inc.id) ?? [] };
};

export const actions: Actions = {
	update: async ({ request, platform, params }) => {
		const db = platform!.env.DB;
		const fd = await request.formData();
		const status = STATUSES.includes(String(fd.get('status'))) ? String(fd.get('status')) : 'investigating';
		const body = String(fd.get('body') ?? '').trim().slice(0, 4000);
		if (!body) return fail(400, { error: 'Write something for the update.' });
		const now = Math.floor(Date.now() / 1000);
		const id = Number(params.id);
		await db.batch([
			db.prepare('INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, ?, ?)').bind(id, now, status, body),
			db
				// A hand-written update makes it yours: no longer hidden as a short automatic blip.
				.prepare('UPDATE incidents SET auto = 0, status = ?, resolved_at = CASE WHEN ? = \'resolved\' THEN coalesce(resolved_at, ?) ELSE NULL END WHERE id = ?')
				.bind(status, status, now, id),
			// A manually resolved incident must not stay attached to the monitor's state.
			db.prepare("UPDATE monitor_state SET incident_id = NULL WHERE incident_id = ? AND ? = 'resolved'").bind(id, status)
		]);
		return { posted: true };
	},
	edit: async ({ request, platform, params }) => {
		const fd = await request.formData();
		const title = String(fd.get('title') ?? '').trim().slice(0, 140);
		if (!title) return fail(400, { error: 'Title can’t be empty.' });
		await platform!.env.DB.prepare('UPDATE incidents SET title = ?, public = ?, auto = 0 WHERE id = ?')
			.bind(title, fd.get('public') === 'on' ? 1 : 0, Number(params.id))
			.run();
		return { edited: true };
	},
	delete: async ({ platform, params }) => {
		const db = platform!.env.DB;
		const id = Number(params.id);
		await db.batch([
			db.prepare('UPDATE monitor_state SET incident_id = NULL WHERE incident_id = ?').bind(id),
			db.prepare('DELETE FROM incidents WHERE id = ?').bind(id)
		]);
		redirect(303, '/admin/incidents');
	}
};
