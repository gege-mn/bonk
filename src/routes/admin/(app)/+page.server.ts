import { adminMonitors } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	return { monitors: await adminMonitors(platform!.env.DB) };
};
