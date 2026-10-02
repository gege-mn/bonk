import { pageStatus } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

// Private pages are signed in and kept out of caches by hooks.server.ts.
export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	const pg = locals.page!;
	if (pg.public) setHeaders({ 'cache-control': 'public, max-age=30' });
	const now = Math.floor(Date.now() / 1000);
	return { status: await pageStatus(platform!.env.DB, pg.id, now), now };
};
