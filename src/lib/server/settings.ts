import { DEFAULT_THEME, normalizeTheme, type Theme } from '../theme';

/** Instance-wide identity, used by the admin and in alerts. Status pages carry their own name and links. */
export interface Site {
	name: string;
	/** Absolute URL of this instance, used for links inside alerts. */
	url: string;
}

export interface Logo {
	mime: 'image/svg+xml' | 'image/png' | 'image/webp';
	/** base64 */
	data: string;
	updated: number;
}

export const DEFAULT_SITE: Site = { name: 'Bonk', url: '' };

// Placeholder mark until Bonk has its own. currentColor is swapped for the theme's ink when served.
export const DEFAULT_LOGO_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><mask id="m"><rect x="8" y="8" width="84" height="84" rx="24.15" fill="#fff"/><circle cx="92" cy="8" r="34.65" fill="#000"/></mask><rect x="8" y="8" width="84" height="84" rx="24.15" fill="currentColor" mask="url(#m)"/></svg>';

export const LOGO_MAX_BYTES = 64 * 1024;

export async function getSetting<T>(db: D1Database, key: string): Promise<T | null> {
	const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
	if (!row) return null;
	try {
		return JSON.parse(row.value) as T;
	} catch {
		return null;
	}
}

export function setSettingStmt(db: D1Database, key: string, value: unknown): D1PreparedStatement {
	return db
		.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
		.bind(key, JSON.stringify(value));
}

export async function setSetting(db: D1Database, key: string, value: unknown): Promise<void> {
	await setSettingStmt(db, key, value).run();
}

export function normalizeSite(input: unknown): Site {
	const s = (input && typeof input === 'object' ? input : {}) as Partial<Site>;
	const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
	const url = str(s.url, 300).replace(/\/+$/, '');
	return {
		name: str(s.name, 60) || DEFAULT_SITE.name,
		url: /^https?:\/\//.test(url) ? url : ''
	};
}

export interface Rules {
	/** Trouble shorter than this many minutes stays off the status page; 0 shows everything. */
	minIncidentMin: number;
}

export const DEFAULT_RULES: Rules = { minIncidentMin: 5 };

export function normalizeRules(input: unknown): Rules {
	const r = (input && typeof input === 'object' ? input : {}) as Partial<Rules>;
	const raw = r.minIncidentMin as unknown;
	const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
	return {
		minIncidentMin: Number.isFinite(n) ? Math.min(1440, Math.max(0, Math.round(n))) : DEFAULT_RULES.minIncidentMin
	};
}

export interface Appearance {
	site: Site;
	theme: Theme;
	rules: Rules;
	logoVersion: number;
	/** Where the logo is served from, cache-busting version included. A status page swaps in its own. */
	logo: string;
}

export async function getAppearance(db: D1Database): Promise<Appearance> {
	const { results } = await db
		.prepare("SELECT key, value FROM settings WHERE key IN ('site', 'theme', 'rules', 'logo_version')")
		.all<{ key: string; value: string }>();
	const map = new Map(results.map((r) => [r.key, r.value]));
	const parse = (k: string) => {
		try {
			return map.has(k) ? JSON.parse(map.get(k)!) : null;
		} catch {
			return null;
		}
	};
	const logoVersion = Number(parse('logo_version')) || 0;
	return {
		site: normalizeSite(parse('site')),
		theme: map.has('theme') ? normalizeTheme(parse('theme')) : DEFAULT_THEME,
		rules: normalizeRules(parse('rules')),
		logoVersion,
		logo: `/brand/logo?v=${logoVersion}`
	};
}

const LOGO_MIMES = ['image/svg+xml', 'image/png', 'image/webp'] as const;

function sniffLogo(bytes: Uint8Array): Logo['mime'] | null {
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return LOGO_MIMES[1];
	if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return LOGO_MIMES[2];
	const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart();
	if (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!--')) return LOGO_MIMES[0];
	return null;
}

/** Validates an uploaded logo. Returns the value to store, or a message for the form. */
export async function readLogoUpload(file: FormDataEntryValue | null): Promise<{ logo: Logo } | { error: string }> {
	if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file.' };
	if (file.size > LOGO_MAX_BYTES) return { error: `That file is ${Math.ceil(file.size / 1024)} KB; the limit is 64 KB.` };
	const bytes = new Uint8Array(await file.arrayBuffer());
	const mime = sniffLogo(bytes);
	if (!mime) return { error: 'Use an SVG, PNG or WebP file.' };
	if (mime === 'image/svg+xml') {
		const problem = checkSvg(new TextDecoder().decode(bytes));
		if (problem) return { error: problem };
	}
	let data = '';
	for (let i = 0; i < bytes.length; i += 0x8000) data += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return { logo: { mime, data: btoa(data), updated: Date.now() } };
}

const HEX = /^#?[0-9a-f]{6}$/i;

/** Serves a stored logo (or the built-in mark) as an image, drawn for the given theme. */
export function logoResponse(logo: Logo | null, theme: Theme, url: URL): Response {
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
}

/**
 * Rejects SVGs that could run code. Logos are also only ever served as images
 * with a locked-down CSP, so this is the second fence, not the only one.
 */
export function checkSvg(svg: string): string | null {
	if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return 'That file is not an SVG.';
	const banned = [
		/<script/i,
		/<foreignObject/i,
		/<iframe/i,
		/<embed/i,
		/<object/i,
		/\son[a-z]+\s*=/i,
		/javascript:/i,
		/<!ENTITY/i,
		/(xlink:)?href\s*=\s*["']\s*(?!#|data:image\/)/i,
		/@import/i
	];
	if (banned.some((r) => r.test(svg))) return 'This SVG has scripts, external links or embedded content. Export a plain SVG.';
	return null;
}
