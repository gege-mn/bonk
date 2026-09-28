import { fail, redirect } from '@sveltejs/kit';
import { previewText, providerMeta, readChannelForm, testChannel } from '$lib/server/channels';
import type { Channel } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const env = platform!.env;
	const { results } = await env.DB.prepare(
		`SELECT c.id, c.name, c.provider, c.default_on, (SELECT count(*) FROM monitor_channels mc WHERE mc.channel_id = c.id) AS monitors
		FROM channels c ORDER BY c.name`
	).all<{ id: number; name: string; provider: string; default_on: number; monitors: number }>();
	const failed = await env.DB.prepare('SELECT channel_id, count(*) AS n, max(last_error) AS err FROM notify_queue GROUP BY channel_id').all<{
		channel_id: number;
		n: number;
		err: string;
	}>();
	return { channels: results, providers: providerMeta(), preview: await previewText(env), queue: failed.results };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const env = platform!.env;
		const fd = await request.formData();
		const r = await readChannelForm(fd, env, null);
		if ('error' in r) return fail(400, { error: r.error });
		if (Object.keys(r.errors).length) return fail(400, { errors: r.errors });
		const row = await env.DB.prepare('INSERT INTO channels (name, provider, config, default_on, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
			.bind(r.name, r.provider.id, JSON.stringify(r.config), r.defaultOn, Math.floor(Date.now() / 1000))
			.first<{ id: number }>();
		if (fd.get('apply_all') === 'on') {
			await env.DB.prepare('INSERT OR IGNORE INTO monitor_channels (monitor_id, channel_id) SELECT id, ? FROM monitors').bind(row!.id).run();
		}
		redirect(303, `/admin/notifications/${row!.id}?created=1`);
	},
	test: async ({ request, platform }) => {
		const env = platform!.env;
		const id = Number((await request.formData()).get('id'));
		const ch = await env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(id).first<Channel>();
		if (!ch) return fail(404, { testError: 'Channel not found' });
		return testChannel(env, ch);
	}
};
