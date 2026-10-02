import { error, fail } from '@sveltejs/kit';
import { pageLogoUrl, pageTheme } from '$lib/server/pages';
import { readLogoUpload } from '$lib/server/settings';
import { normalizeTheme } from '$lib/theme';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { pg, appearance } = await parent();
	return {
		// What the editor starts from: the page's own theme, or the site's while it follows it.
		theme: pageTheme(pg, appearance.theme),
		// The page's public logo route, which already falls back to the site logo.
		logoUrl: pageLogoUrl(pg, appearance)
	};
};

// Actions don't run the layout load, so a deleted or mistyped page has to 404 here too.
async function run(stmt: D1PreparedStatement) {
	const res = await stmt.run();
	if (!res.meta.changes) error(404, 'No such page.');
}

export const actions: Actions = {
	theme: async ({ request, platform, params }) => {
		const fd = await request.formData();
		let raw: unknown;
		try {
			raw = JSON.parse(String(fd.get('theme') ?? '{}'));
		} catch {
			return fail(400, { error: 'Could not read the theme.' });
		}
		await run(platform!.env.DB.prepare('UPDATE pages SET theme = ? WHERE id = ?').bind(JSON.stringify(normalizeTheme(raw)), Number(params.id)));
		return { saved: 'theme' };
	},
	// Back to the site theme. The logo is a separate choice and stays.
	reset: async ({ platform, params }) => {
		await run(platform!.env.DB.prepare('UPDATE pages SET theme = NULL WHERE id = ?').bind(Number(params.id)));
		return { saved: 'reset' };
	},
	logo: async ({ request, platform, params }) => {
		const fd = await request.formData();
		const read = await readLogoUpload(fd.get('logo'));
		if ('error' in read) return fail(400, { logoError: read.error });
		await run(
			platform!.env.DB.prepare('UPDATE pages SET logo = ?, logo_version = ? WHERE id = ?').bind(JSON.stringify(read.logo), Date.now(), Number(params.id))
		);
		return { saved: 'logo' };
	},
	removeLogo: async ({ platform, params }) => {
		await run(platform!.env.DB.prepare('UPDATE pages SET logo = NULL, logo_version = ? WHERE id = ?').bind(Date.now(), Number(params.id)));
		return { saved: 'logo' };
	}
};
