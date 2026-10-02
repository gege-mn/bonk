import { getAppearance, getSetting, logoResponse, type Logo } from '$lib/server/settings';
import type { RequestHandler } from './$types';

// The site logo: the admin's, and any status page's that hasn't uploaded its own.
export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform!.env.DB;
	const [logo, { theme }] = await Promise.all([getSetting<Logo>(db, 'logo'), getAppearance(db)]);
	return logoResponse(logo, theme, url);
};
