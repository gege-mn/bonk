import { pageBase, pageLinks, pageLogoUrl, pageTheme } from '$lib/server/pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params, parent }) => {
	// Reading the slug makes this rerun when someone moves between pages, so the theme follows them.
	void params.slug;
	const pg = locals.page!;
	const { appearance } = await parent();
	const base = pageBase(pg);
	return {
		// Overrides the site's theme and logo from the root layout with this page's.
		appearance: {
			...appearance,
			theme: pageTheme(pg, appearance.theme),
			logo: pageLogoUrl(pg, appearance)
		},
		statusPage: {
			name: pg.name,
			description: pg.description,
			links: pageLinks(pg),
			/** Path prefix for this page's own links: '' for the default page. */
			base,
			private: !pg.public
		}
	};
};
