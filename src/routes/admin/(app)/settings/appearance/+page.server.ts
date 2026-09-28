import { fail } from '@sveltejs/kit';
import { checkSvg, LOGO_MAX_BYTES, setSettingStmt } from '$lib/server/settings';
import { normalizeTheme, PRESETS } from '$lib/theme';
import type { Actions } from './$types';

const MIMES = ['image/svg+xml', 'image/png', 'image/webp'] as const;

function sniff(bytes: Uint8Array): (typeof MIMES)[number] | null {
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
	if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
	const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart();
	if (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!--')) return 'image/svg+xml';
	return null;
}

const b64 = (bytes: Uint8Array) => {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
};

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
		const file = fd.get('logo');
		if (!(file instanceof File) || file.size === 0) return fail(400, { logoError: 'Choose a file.' });
		if (file.size > LOGO_MAX_BYTES) return fail(400, { logoError: `That file is ${Math.ceil(file.size / 1024)} KB; the limit is 64 KB.` });
		const bytes = new Uint8Array(await file.arrayBuffer());
		const mime = sniff(bytes);
		if (!mime) return fail(400, { logoError: 'Use an SVG, PNG or WebP file.' });
		if (mime === 'image/svg+xml') {
			const problem = checkSvg(new TextDecoder().decode(bytes));
			if (problem) return fail(400, { logoError: problem });
		}
		const db = platform!.env.DB;
		await db.batch([
			setSettingStmt(db, 'logo', { mime, data: b64(bytes), updated: Date.now() }),
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
