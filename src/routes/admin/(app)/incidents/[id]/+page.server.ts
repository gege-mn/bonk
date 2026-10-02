import { error, fail, redirect } from '@sveltejs/kit';
import { setIncidentPagesStmts } from '$lib/server/pages';
import { updatesFor } from '$lib/server/repo';
import type { Incident } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

export const load: PageServerLoad = async ({ platform, params }) => {
	const db = platform!.env.DB;
	const inc = await db.prepare('SELECT * FROM incidents WHERE id = ?').bind(Number(params.id)).first<Incident>();
	if (!inc) error(404, 'No such incident');
	const [updates, pages, on] = await Promise.all([
		updatesFor(db, [inc.id]),
		db
			.prepare('SELECT id, name, public, is_default FROM pages ORDER BY is_default DESC, name COLLATE NOCASE, id')
			.all<{ id: number; name: string; public: number; is_default: number }>(),
		// Same rule as INCIDENT_ON_PAGE: its monitor's pages, plus the ones it was pinned to.
		db
			.prepare('SELECT page_id FROM page_monitors WHERE monitor_id = ?1 UNION SELECT page_id FROM incident_pages WHERE incident_id = ?2')
			.bind(inc.monitor_id, inc.id)
			.all<{ page_id: number }>()
	]);
	return { incident: inc, updates: updates.get(inc.id) ?? [], pages: pages.results, pageIds: on.results.map((r) => r.page_id) };
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
		const db = platform!.env.DB;
		const fd = await request.formData();
		const id = Number(params.id);
		const title = String(fd.get('title') ?? '').trim().slice(0, 140);
		if (!title) return fail(400, { error: 'Title can’t be empty.' });
		const inc = await db.prepare('SELECT monitor_id FROM incidents WHERE id = ?').bind(id).first<{ monitor_id: number | null }>();
		if (!inc) error(404, 'No such incident');
		await db.batch([
			db.prepare('UPDATE incidents SET title = ?, public = ?, auto = 0 WHERE id = ?').bind(title, fd.get('public') === 'on' ? 1 : 0, id),
			// With a monitor the form has no page list, and its pages are the monitor's anyway.
			...(inc.monitor_id ? [] : setIncidentPagesStmts(db, id, fd.getAll('pages').map(Number)))
		]);
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
