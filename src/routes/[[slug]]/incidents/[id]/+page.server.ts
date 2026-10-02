import { error } from '@sveltejs/kit';
import { pageIncident, updatesFor } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params, locals, setHeaders }) => {
	const db = platform!.env.DB;
	const pg = locals.page!;
	// An incident is only readable through a page that shows it, so a private page's never leak through a public URL.
	const inc = await pageIncident(db, pg.id, Number(params.id));
	if (!inc) error(404, 'No such incident');
	if (pg.public) setHeaders({ 'cache-control': 'public, max-age=30' });
	const updates = (await updatesFor(db, [inc.id])).get(inc.id) ?? [];
	return { incident: inc, updates };
};
