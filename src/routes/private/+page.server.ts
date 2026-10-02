import { publicStatus } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

// Sign-in is enforced in hooks.server.ts, which also keeps this page out of caches.
export const load: PageServerLoad = async ({ platform }) => {
	const now = Math.floor(Date.now() / 1000);
	return { status: await publicStatus(platform!.env.DB, now, true), now };
};
