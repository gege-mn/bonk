import { DEFAULT_THEME, normalizeTheme, type Theme } from '../theme';

export interface Site {
	name: string;
	/** Tagline under the status headline; empty hides it. */
	description: string;
	/** Absolute URL of this instance, used for links inside alerts. */
	url: string;
	/** Header links on the public page. */
	links: { label: string; href: string }[];
}

export interface Logo {
	mime: 'image/svg+xml' | 'image/png' | 'image/webp';
	/** base64 */
	data: string;
	updated: number;
}

export const DEFAULT_SITE: Site = { name: 'Bonk', description: '', url: '', links: [] };

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
		description: str(s.description, 300),
		url: /^https?:\/\//.test(url) ? url : '',
		links: Array.isArray(s.links)
			? s.links
					.map((l) => ({ label: str(l?.label, 40), href: str(l?.href, 300) }))
					.filter((l) => l.label && /^(https?:|mailto:)/.test(l.href))
					.slice(0, 5)
			: []
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
	return {
		site: normalizeSite(parse('site')),
		theme: map.has('theme') ? normalizeTheme(parse('theme')) : DEFAULT_THEME,
		rules: normalizeRules(parse('rules')),
		logoVersion: Number(parse('logo_version')) || 0
	};
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
