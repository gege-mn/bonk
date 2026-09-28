import { fail } from '@sveltejs/kit';
import type { Maintenance } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform!.env.DB;
	const now = Math.floor(Date.now() / 1000);
	const [list, monitors] = await Promise.all([
		db.prepare('SELECT * FROM maintenance WHERE ends_at > ? ORDER BY starts_at').bind(now - 7 * 86400).all<Maintenance>(),
		db.prepare('SELECT id, name FROM monitors ORDER BY name').all<{ id: number; name: string }>()
	]);
	return { windows: list.results, monitors: monitors.results, now };
};

/** datetime-local values carry no zone; the form sends the browser's offset alongside. */
function parseLocal(v: FormDataEntryValue | null, offsetMin: number): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v ?? ''));
	if (!m) return null;
	const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 1000;
	return utc + offsetMin * 60;
}

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const fd = await request.formData();
		const offset = Number(fd.get('tz_offset')) || 0;
		const title = String(fd.get('title') ?? '').trim().slice(0, 140);
		const starts = parseLocal(fd.get('starts_at'), offset);
		const ends = parseLocal(fd.get('ends_at'), offset);
		if (!title || starts === null || ends === null) return fail(400, { error: 'Title, start and end are required.' });
		if (ends <= starts) return fail(400, { error: 'The window must end after it starts.' });
		const ids = fd.getAll('monitors').map(Number).filter((n) => n > 0);
		await platform!.env.DB.prepare('INSERT INTO maintenance (title, body, starts_at, ends_at, monitor_ids) VALUES (?, ?, ?, ?, ?)')
			.bind(title, String(fd.get('body') ?? '').trim().slice(0, 2000), starts, ends, JSON.stringify(ids))
			.run();
		return { created: true };
	},
	delete: async ({ request, platform }) => {
		const id = Number((await request.formData()).get('id'));
		await platform!.env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(id).run();
		return { deleted: true };
	}
};
