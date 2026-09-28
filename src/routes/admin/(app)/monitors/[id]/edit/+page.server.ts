import { error } from '@sveltejs/kit';
import { formContext, saveMonitor, testAction } from '$lib/server/monitorActions';
import type { Monitor } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params, url }) => {
	const db = platform!.env.DB;
	const id = Number(params.id);
	const [m, links, ctx] = await Promise.all([
		db.prepare('SELECT * FROM monitors WHERE id = ?').bind(id).first<Monitor>(),
		db.prepare('SELECT channel_id FROM monitor_channels WHERE monitor_id = ?').bind(id).all<{ channel_id: number }>(),
		formContext(db)
	]);
	if (!m) error(404, 'No such monitor');
	return { monitor: m, channelIds: links.results.map((l) => l.channel_id), origin: url.origin, ...ctx };
};

export const actions: Actions = {
	test: testAction,
	save: (event) => saveMonitor(event, Number(event.params.id))
};
