import { error } from '@sveltejs/kit';
import { updatesFor } from '$lib/server/repo';
import type { Incident } from '$lib/server/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params, setHeaders }) => {
	const db = platform!.env.DB;
	const inc = await db
		.prepare('SELECT * FROM incidents WHERE id = ? AND public = 1')
		.bind(Number(params.id))
		.first<Incident>();
	if (!inc) error(404, 'No such incident');
	setHeaders({ 'cache-control': 'public, max-age=30' });
	const updates = (await updatesFor(db, [inc.id])).get(inc.id) ?? [];
	return { incident: inc, updates };
};
