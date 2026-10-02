import { fail } from '@sveltejs/kit';
import { readLogoUpload, setSettingStmt } from '$lib/server/settings';
import { normalizeTheme, PRESETS } from '$lib/theme';
import type { Actions } from './$types';

export const actions: Actions = {
	theme: async ({ request, platform }) => {
		const fd = await request.formData();
		let raw: unknown;
		try {
			raw = JSON.parse(String(fd.get('theme') ?? '{}'));
		} catch {
			return fail(400, { error: 'Could not read the theme.' });
		}
		const db = platform!.env.DB;
		await db.batch([setSettingStmt(db, 'theme', normalizeTheme(raw))]);
		return { saved: 'theme' };
	},
	reset: async ({ platform }) => {
		const db = platform!.env.DB;
		await db.batch([
			setSettingStmt(db, 'theme', PRESETS.gege.theme),
			db.prepare("DELETE FROM settings WHERE key = 'logo'"),
			setSettingStmt(db, 'logo_version', Date.now())
		]);
		return { saved: 'reset' };
	},
	logo: async ({ request, platform }) => {
		const fd = await request.formData();
		const read = await readLogoUpload(fd.get('logo'));
		if ('error' in read) return fail(400, { logoError: read.error });
		const db = platform!.env.DB;
		await db.batch([
			setSettingStmt(db, 'logo', read.logo),
			setSettingStmt(db, 'logo_version', Date.now())
		]);
		return { saved: 'logo' };
	},
	removeLogo: async ({ platform }) => {
		const db = platform!.env.DB;
		await db.batch([db.prepare("DELETE FROM settings WHERE key = 'logo'"), setSettingStmt(db, 'logo_version', Date.now())]);
		return { saved: 'logo' };
	}
};
