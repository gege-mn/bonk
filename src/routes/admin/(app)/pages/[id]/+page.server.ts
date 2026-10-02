import { fail, redirect } from '@sveltejs/kit';
import { authMode } from '$lib/server/auth';
import { pageLinks, parsePageForm } from '$lib/server/pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, parent }) => {
	const { pg } = await parent();
	return { links: pageLinks(pg), auth: authMode(platform!.env) };
};

export const actions: Actions = {
	save: async ({ request, platform, params }) => {
		const db = platform!.env.DB;
		const id = Number(params.id);
		const { values, errors } = parsePageForm(await request.formData());
		const taken = () => `Another page already uses /${values.slug}.`;
		if (!errors.slug && (await db.prepare('SELECT 1 FROM pages WHERE slug = ? AND id <> ?').bind(values.slug, id).first())) {
			errors.slug = taken();
		}
		if (Object.keys(errors).length) return fail(400, { values, errors });
		try {
			await db
				.prepare('UPDATE pages SET slug = ?, name = ?, description = ?, links = ?, public = ? WHERE id = ?')
				.bind(values.slug, values.name, values.description, JSON.stringify(values.links), values.public, id)
				.run();
		} catch (e) {
			if (!String(e).includes('UNIQUE')) throw e;
			return fail(400, { values, errors: { slug: taken() } as Record<string, string> });
		}
		return { saved: true };
	},
	makeDefault: async ({ platform, params }) => {
		const db = platform!.env.DB;
		const id = Number(params.id);
		if (!(await db.prepare('SELECT 1 FROM pages WHERE id = ?').bind(id).first())) return fail(404, { error: 'No such status page.' });
		// Unset first: pages_one_default allows only one default at any moment.
		await db.batch([
			db.prepare('UPDATE pages SET is_default = 0 WHERE is_default = 1 AND id <> ?').bind(id),
			db.prepare('UPDATE pages SET is_default = 1 WHERE id = ?').bind(id)
		]);
		return { madeDefault: true };
	},
	delete: async ({ platform, params }) => {
		// The guard is in the statement so a page made default a moment ago still survives.
		const res = await platform!.env.DB.prepare('DELETE FROM pages WHERE id = ? AND is_default = 0').bind(Number(params.id)).run();
		if (!res.meta.changes) return fail(400, { error: 'The default page can’t be deleted. Make another page the default first.' });
		redirect(303, '/admin/pages');
	}
};
