import { redirect } from '@sveltejs/kit';
import { authMode } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	if (authMode(platform!.env) !== 'unconfigured') redirect(303, '/admin');
	return {};
};
