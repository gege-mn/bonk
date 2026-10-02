import { fail } from '@sveltejs/kit';
import { authMode } from '$lib/server/auth';
import { normalizeRules, normalizeSite, setSettingStmt } from '$lib/server/settings';
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
		const site = normalizeSite({ name: fd.get('name'), url: fd.get('url') });
		if (!String(fd.get('name') ?? '').trim()) return fail(400, { error: 'The name can’t be empty.' });
		const db = platform!.env.DB;
		const rules = normalizeRules({ minIncidentMin: fd.get('min_incident_min') });
		await db.batch([setSettingStmt(db, 'site', site), setSettingStmt(db, 'rules', rules)]);
		return { saved: true };
	}
};
