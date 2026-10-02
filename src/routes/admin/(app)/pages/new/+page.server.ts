import { fail, redirect } from '@sveltejs/kit';
import { parsePageForm } from '$lib/server/pages';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const db = platform!.env.DB;
		const { values, errors } = parsePageForm(await request.formData());
		if (!errors.slug && (await db.prepare('SELECT 1 FROM pages WHERE slug = ?').bind(values.slug).first())) {
			errors.slug = `Another page already uses /${values.slug}.`;
		}
		if (Object.keys(errors).length) return fail(400, { values, errors });
		let id: number;
		try {
			const res = await db
				.prepare('INSERT INTO pages (slug, name, description, public, created_at) VALUES (?, ?, ?, ?, ?)')
				.bind(values.slug, values.name, values.description, values.public, Math.floor(Date.now() / 1000))
				.run();
			id = res.meta.last_row_id;
		} catch (e) {
			// Two creates racing past the check above.
			if (!String(e).includes('UNIQUE')) throw e;
			return fail(400, { values, errors: { slug: `Another page already uses /${values.slug}.` } as Record<string, string> });
		}
		redirect(303, `/admin/pages/${id}/monitors`);
	}
};
