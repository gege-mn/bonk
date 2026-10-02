import { error } from '@sveltejs/kit';
import { PAGE_COLUMNS, type PageRow } from '$lib/server/pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, params }) => {
	const pg = await platform!.env.DB.prepare(`SELECT ${PAGE_COLUMNS} FROM pages WHERE id = ?`).bind(Number(params.id)).first<PageRow>();
	if (!pg) error(404, 'No such status page');
	return { pg };
};
