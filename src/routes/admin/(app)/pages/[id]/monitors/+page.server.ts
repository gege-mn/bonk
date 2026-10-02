import { fail } from '@sveltejs/kit';
import { parsePageMonitors, setPageMonitorsStmts } from '$lib/server/pages';
import type { MonitorType } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params }) => {
	const db = platform!.env.DB;
	const [rows, monitors] = await Promise.all([
		db
			.prepare(
				`SELECT pm.monitor_id, pm.group_name, pm.display_name FROM page_monitors pm
				JOIN monitors m ON m.id = pm.monitor_id WHERE pm.page_id = ? ORDER BY pm.sort, m.id`
			)
			.bind(Number(params.id))
			.all<{ monitor_id: number; group_name: string; display_name: string | null }>(),
		db
			.prepare('SELECT id, name, public_name, type, target FROM monitors ORDER BY name COLLATE NOCASE, id')
			.all<{ id: number; name: string; public_name: string | null; type: MonitorType; target: string }>()
	]);
	return { rows: rows.results, monitors: monitors.results };
};

export const actions: Actions = {
	save: async ({ request, platform, params }) => {
		const db = platform!.env.DB;
		const id = Number(params.id);
		const raw = String((await request.formData()).get('monitors') ?? '');
		const [pg, all] = await Promise.all([
			db.prepare('SELECT 1 FROM pages WHERE id = ?').bind(id).first(),
			db.prepare('SELECT id FROM monitors').all<{ id: number }>()
		]);
		if (!pg) return fail(404, { error: 'No such status page.' });
		const rows = parsePageMonitors(raw, new Set(all.results.map((m) => m.id)));
		if (!rows) return fail(400, { error: 'Couldn’t read the monitor list. Reload the page and try again.' });
		await db.batch(setPageMonitorsStmts(db, id, rows));
		return { saved: true, count: rows.length };
	}
};
