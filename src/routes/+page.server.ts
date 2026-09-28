import { publicStatus } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });
	const now = Math.floor(Date.now() / 1000);
	return { status: await publicStatus(platform!.env.DB, now), now };
};
