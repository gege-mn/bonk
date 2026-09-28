import { getAppearance, getSetting, DEFAULT_LOGO_SVG, type Logo } from '$lib/server/settings';
import type { RequestHandler } from './$types';

const HEX = /^#?[0-9a-f]{6}$/i;

export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform!.env.DB;
	const [logo, { theme }] = await Promise.all([getSetting<Logo>(db, 'logo'), getAppearance(db)]);
	const palette = theme.mode === 'dark' ? theme.dark : theme.light;

	// currentColor can't inherit through <img>, so bake the color in: ?color=<hex> or ?on=ink (drawn on ink).
	const want = url.searchParams.get('color');
	const color = want && HEX.test(want) ? `#${want.replace('#', '')}` : url.searchParams.get('on') === 'ink' ? palette.bg : palette.ink;

	let body: BodyInit;
	let type: string;
	if (!logo) {
		body = DEFAULT_LOGO_SVG.replaceAll('currentColor', color);
		type = 'image/svg+xml';
	} else if (logo.mime === 'image/svg+xml') {
		body = new TextDecoder().decode(Uint8Array.from(atob(logo.data), (c) => c.charCodeAt(0))).replaceAll('currentColor', color);
		type = 'image/svg+xml';
	} else {
		body = Uint8Array.from(atob(logo.data), (c) => c.charCodeAt(0));
		type = logo.mime;
	}
	return new Response(body, {
		headers: {
			'content-type': type,
			'cache-control': 'public, max-age=300',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
			'x-content-type-options': 'nosniff'
		}
	});
};
