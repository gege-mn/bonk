import { getAppearance } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform }) => {
	return { appearance: await getAppearance(platform!.env.DB) };
};
