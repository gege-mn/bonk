import { fail, redirect } from '@sveltejs/kit';
import { setIncidentPagesStmts } from '$lib/server/pages';
import type { Incident } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const [list, monitors, pages] = await Promise.all([
		db
			.prepare(
				// page_count mirrors INCIDENT_ON_PAGE: its monitor's pages, plus the ones it was pinned to.
				`SELECT i.*, m.name AS monitor_name,
					(SELECT count(*) FROM (
						SELECT page_id FROM page_monitors pm WHERE pm.monitor_id = i.monitor_id
						UNION SELECT page_id FROM incident_pages ip WHERE ip.incident_id = i.id
					)) AS page_count
				FROM incidents i LEFT JOIN monitors m ON m.id = i.monitor_id
				ORDER BY i.resolved_at IS NOT NULL, i.started_at DESC LIMIT 100`
			)
			.all<Incident & { monitor_name: string | null; page_count: number }>(),
		db.prepare('SELECT id, name FROM monitors ORDER BY name').all<{ id: number; name: string }>(),
		db
			.prepare('SELECT id, name, public, is_default FROM pages ORDER BY is_default DESC, name COLLATE NOCASE, id')
			.all<{ id: number; name: string; public: number; is_default: number }>()
	]);
	return { incidents: list.results, monitors: monitors.results, pages: pages.results };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const db = platform!.env.DB;
		const fd = await request.formData();
		const title = String(fd.get('title') ?? '').trim().slice(0, 140);
		const body = String(fd.get('body') ?? '').trim().slice(0, 4000);
		const severity = ['down', 'degraded', 'info'].includes(String(fd.get('severity'))) ? String(fd.get('severity')) : 'info';
		if (!title || !body) return fail(400, { error: 'Give the incident a title and a first update.' });
		const monitorId = Number(fd.get('monitor_id')) || null;
		const now = Math.floor(Date.now() / 1000);
		const row = await db
			.prepare("INSERT INTO incidents (monitor_id, title, severity, status, auto, public, started_at) VALUES (?, ?, ?, 'investigating', 0, ?, ?) RETURNING id")
			.bind(monitorId, title, severity, fd.get('public') === 'on' ? 1 : 0, now)
			.first<{ id: number }>();
		await db.batch([
			db.prepare("INSERT INTO incident_updates (incident_id, ts, status, body) VALUES (?, ?, 'investigating', ?)").bind(row!.id, now, body),
			// With a monitor it goes wherever the monitor is, so the page list only counts without one.
			...(monitorId ? [] : setIncidentPagesStmts(db, row!.id, fd.getAll('pages').map(Number)))
		]);
		redirect(303, `/admin/incidents/${row!.id}`);
	}
};
