import { listPages } from '$lib/server/pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => ({ pages: await listPages(platform!.env.DB) });
