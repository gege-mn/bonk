import { fail } from '@sveltejs/kit';
import { authMode } from '$lib/server/auth';
import { normalizeSite, setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
	const env = platform!.env;
	return {
		auth: authMode(env),
		teamDomain: env.CF_TEAM_DOMAIN ?? null,
		hasPassword: !!env.ADMIN_PASSWORD,
		hasKey: !!env.ENCRYPTION_KEY,
		origin: url.origin
	};
};

export const actions: Actions = {
	site: async ({ request, platform }) => {
		const fd = await request.formData();
		const labels = fd.getAll('link_label').map(String);
		const hrefs = fd.getAll('link_href').map(String);
		const site = normalizeSite({
			name: fd.get('name'),
			description: fd.get('description'),
			url: fd.get('url'),
			links: labels.map((label, i) => ({ label, href: hrefs[i] ?? '' }))
		});
		if (!String(fd.get('name') ?? '').trim()) return fail(400, { error: 'The name can’t be empty.' });
		await setSetting(platform!.env.DB, 'site', site);
		return { saved: true };
	}
};
