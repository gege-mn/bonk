import { formContext, saveMonitor, testAction } from '$lib/server/monitorActions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => formContext(platform!.env.DB);

export const actions: Actions = {
	test: testAction,
	save: (event) => saveMonitor(event, null)
};
