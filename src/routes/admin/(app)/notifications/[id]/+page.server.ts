import { error, fail, redirect } from '@sveltejs/kit';
import { providerMeta, publicConfig, readChannelForm, testChannel } from '$lib/server/channels';
import type { Channel } from '$lib/server/types';
import type { Actions, PageServerLoad } from './$types';

async function channel(db: D1Database, id: string) {
	const ch = await db.prepare('SELECT * FROM channels WHERE id = ?').bind(Number(id)).first<Channel>();
	if (!ch) error(404, 'No such channel');
	return ch;
}

export const load: PageServerLoad = async ({ platform, params, url }) => {
	const ch = await channel(platform!.env.DB, params.id);
	return {
		channel: { id: ch.id, name: ch.name, provider: ch.provider, default_on: ch.default_on },
		values: publicConfig(ch),
		providers: providerMeta().filter((p) => p.id === ch.provider),
		created: url.searchParams.has('created')
	};
};

export const actions: Actions = {
	save: async ({ request, platform, params }) => {
		const env = platform!.env;
		const ch = await channel(env.DB, params.id);
		const fd = await request.formData();
		fd.set('provider', ch.provider);
		const r = await readChannelForm(fd, env, ch);
		if ('error' in r) return fail(400, { error: r.error });
		if (Object.keys(r.errors).length) return fail(400, { errors: r.errors });
		await env.DB.prepare('UPDATE channels SET name = ?, config = ?, default_on = ? WHERE id = ?')
			.bind(r.name, JSON.stringify(r.config), r.defaultOn, ch.id)
			.run();
		return { saved: true };
	},
	test: async ({ platform, params }) => testChannel(platform!.env, await channel(platform!.env.DB, params.id)),
	delete: async ({ platform, params }) => {
		await platform!.env.DB.prepare('DELETE FROM channels WHERE id = ?').bind(Number(params.id)).run();
		redirect(303, '/admin/notifications');
	}
};
