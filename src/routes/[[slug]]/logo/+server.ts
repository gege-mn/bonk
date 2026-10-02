import { pageTheme } from '$lib/server/pages';
import { getAppearance, getSetting, logoResponse, type Logo } from '$lib/server/settings';
import type { RequestHandler } from './$types';

// A page's own logo, or the site's drawn in this page's colors when it hasn't uploaded one.
export const GET: RequestHandler = async ({ platform, locals, url }) => {
	const db = platform!.env.DB;
	const pg = locals.page!;
	const [own, site] = await Promise.all([
		db.prepare('SELECT logo FROM pages WHERE id = ?').bind(pg.id).first<{ logo: string | null }>(),
		getAppearance(db)
	]);
	let logo: Logo | null = null;
	try {
		logo = own?.logo ? (JSON.parse(own.logo) as Logo) : await getSetting<Logo>(db, 'logo');
	} catch {
		// An unreadable row falls back to the built-in mark.
	}
	return logoResponse(logo, pageTheme(pg, site.theme), url);
};
