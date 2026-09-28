/**
 * Bonk's design tokens. Every surface (public page and admin) reads colors, fonts
 * and radius only through the CSS variables generated here, so a theme is data.
 * Documented in docs/design-system.md — keep the two in sync.
 */

export const COLOR_TOKENS = [
	{ key: 'bg', label: 'Background', help: 'Page background.' },
	{ key: 'surface', label: 'Surface', help: 'Cards, inputs and panels that sit on the background.' },
	{ key: 'ink', label: 'Text', help: 'Body text, headings, strong borders. Also the admin sidebar.' },
	{ key: 'muted', label: 'Muted text', help: 'Captions, timestamps, secondary labels. Keep ≥ 4.5:1 on Background.' },
	{ key: 'line', label: 'Hairline', help: 'Dividers and input borders.' },
	{ key: 'accent', label: 'Accent', help: 'Links, primary buttons, focus rings, selection.' },
	{ key: 'accentInk', label: 'Text on accent', help: 'Text drawn on top of Accent (button labels).' },
	{ key: 'up', label: 'Up', help: 'Healthy bars and dots. Deliberately quiet.' },
	{ key: 'degraded', label: 'Degraded', help: 'Slow or flaky. Must differ from Down in lightness, not just hue.' },
	{ key: 'down', label: 'Down', help: 'Outages. The loudest color on the page.' },
	{ key: 'nodata', label: 'No data', help: 'Days before a monitor existed or while paused.' }
] as const;

export type ColorKey = (typeof COLOR_TOKENS)[number]['key'];
export type Palette = Record<ColorKey, string>;

export type Radius = 'square' | 'soft' | 'round';
export type Mode = 'light' | 'dark' | 'system';

export interface Theme {
	preset: string;
	mode: Mode;
	light: Palette;
	dark: Palette;
	fonts: { display: string; heading: string; body: string };
	radius: Radius;
}

export const RADIUS_PX: Record<Radius, { sm: number; md: number }> = {
	square: { sm: 0, md: 0 },
	soft: { sm: 4, md: 8 },
	round: { sm: 8, md: 16 }
};

/** Generic families need no webfont; anything else is loaded from Google Fonts. */
export const SYSTEM_FONTS: Record<string, string> = {
	'System sans': 'system-ui, -apple-system, "Segoe UI", sans-serif',
	'System serif': 'ui-serif, Georgia, "Times New Roman", serif',
	'System mono': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
};

export const FONT_CHOICES = [
	'Oswald',
	'Space Grotesk',
	'Space Mono',
	'IBM Plex Sans',
	'IBM Plex Mono',
	'IBM Plex Serif',
	'DM Sans',
	'DM Mono',
	'Manrope',
	'Archivo',
	'Archivo Narrow',
	'Bricolage Grotesque',
	'Instrument Sans',
	'Instrument Serif',
	'JetBrains Mono',
	'Fira Code',
	'Newsreader',
	'Source Serif 4',
	'Work Sans',
	'Anton',
	'Bebas Neue',
	...Object.keys(SYSTEM_FONTS)
];

const gegeLight: Palette = {
	bg: '#f5f2ea',
	surface: '#fbf9f4',
	ink: '#14110d',
	muted: '#736d60',
	line: '#e3ddd0',
	accent: '#6d28d9',
	accentInk: '#ffffff',
	up: '#3a342c',
	degraded: '#d99a1e',
	down: '#e0461a',
	nodata: '#e3ddd0'
};

const gegeDark: Palette = {
	bg: '#15120e',
	surface: '#1e1a15',
	ink: '#f1ece0',
	muted: '#a39b8a',
	line: '#35302a',
	accent: '#b395fb',
	accentInk: '#14110d',
	up: '#c9c0ad',
	degraded: '#e8b04a',
	down: '#ff6a3d',
	nodata: '#35302a'
};

export const PRESETS: Record<string, { name: string; theme: Theme }> = {
	gege: {
		name: 'Gege (default)',
		theme: {
			preset: 'gege',
			mode: 'light',
			light: gegeLight,
			dark: gegeDark,
			fonts: { display: 'Oswald', heading: 'Space Grotesk', body: 'Space Mono' },
			radius: 'square'
		}
	},
	night: {
		name: 'Night',
		theme: {
			preset: 'night',
			mode: 'dark',
			light: gegeLight,
			dark: {
				bg: '#111016',
				surface: '#1a1822',
				ink: '#ece8f5',
				muted: '#9d97ad',
				line: '#2c2938',
				accent: '#a78bfa',
				accentInk: '#111016',
				up: '#8f89a3',
				degraded: '#f2b84b',
				down: '#ff6b57',
				nodata: '#2c2938'
			},
			fonts: { display: 'Bricolage Grotesque', heading: 'Bricolage Grotesque', body: 'IBM Plex Mono' },
			radius: 'soft'
		}
	},
	plain: {
		name: 'Plain',
		theme: {
			preset: 'plain',
			mode: 'system',
			light: {
				bg: '#ffffff',
				surface: '#f6f7f9',
				ink: '#16181d',
				muted: '#5f6673',
				line: '#e3e6ea',
				accent: '#2456d6',
				accentInk: '#ffffff',
				up: '#39404d',
				degraded: '#d99a1e',
				down: '#d9391a',
				nodata: '#e3e6ea'
			},
			dark: {
				bg: '#0f1115',
				surface: '#171a20',
				ink: '#e8eaee',
				muted: '#9aa1ad',
				line: '#282c34',
				accent: '#7aa2ff',
				accentInk: '#0f1115',
				up: '#b7bdc8',
				degraded: '#e8b04a',
				down: '#ff6a4d',
				nodata: '#282c34'
			},
			fonts: { display: 'System sans', heading: 'System sans', body: 'System sans' },
			radius: 'round'
		}
	}
};

export const DEFAULT_THEME: Theme = PRESETS.gege.theme;

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{1,40}$/;

/** Anything read from the database or a form goes through here before it reaches CSS. */
export function normalizeTheme(input: unknown): Theme {
	const t = (input && typeof input === 'object' ? input : {}) as Partial<Theme>;
	const base = PRESETS[t.preset ?? '']?.theme ?? DEFAULT_THEME;
	const palette = (p: unknown, fallback: Palette): Palette => {
		const src = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
		const out = { ...fallback };
		for (const { key } of COLOR_TOKENS) {
			const v = src[key];
			if (typeof v === 'string' && HEX.test(v)) out[key] = v.toLowerCase();
		}
		return out;
	};
	const font = (v: unknown, fallback: string) => (typeof v === 'string' && FONT.test(v) ? v : fallback);
	const f = (t.fonts ?? {}) as Partial<Theme['fonts']>;
	return {
		preset: typeof t.preset === 'string' ? t.preset : base.preset,
		mode: t.mode === 'dark' || t.mode === 'system' || t.mode === 'light' ? t.mode : base.mode,
		light: palette(t.light, base.light),
		dark: palette(t.dark, base.dark),
		fonts: {
			display: font(f.display, base.fonts.display),
			heading: font(f.heading, base.fonts.heading),
			body: font(f.body, base.fonts.body)
		},
		radius: t.radius === 'soft' || t.radius === 'round' || t.radius === 'square' ? t.radius : base.radius
	};
}

const cssVar = (k: string) => `--bonk-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;

function fontStack(name: string, role: 'display' | 'heading' | 'body'): string {
	if (SYSTEM_FONTS[name]) return SYSTEM_FONTS[name];
	const fallback =
		role === 'body' && /mono|code/i.test(name) ? SYSTEM_FONTS['System mono'] : SYSTEM_FONTS['System sans'];
	return `"${name}", ${fallback}`;
}

/** Text color for a filled status tag: whichever of ink/bg reads better on it. */
const onColor = (fill: string, p: Palette) => (contrast(fill, p.ink) >= contrast(fill, p.bg) ? p.ink : p.bg);

function paletteVars(p: Palette): string {
	const base = COLOR_TOKENS.map(({ key }) => `${cssVar(key)}:${p[key]};`).join('');
	return (
		base +
		`--bonk-on-up:${onColor(p.up, p)};--bonk-on-degraded:${onColor(p.degraded, p)};` +
		`--bonk-on-down:${onColor(p.down, p)};--bonk-on-accent-soft:${onColor(p.accent, p)};`
	);
}

export function themeCss(t: Theme, selector = ':root'): string {
	const r = RADIUS_PX[t.radius];
	const shared =
		`--bonk-font-display:${fontStack(t.fonts.display, 'display')};` +
		`--bonk-font-heading:${fontStack(t.fonts.heading, 'heading')};` +
		`--bonk-font-body:${fontStack(t.fonts.body, 'body')};` +
		`--bonk-radius-sm:${r.sm}px;--bonk-radius-md:${r.md}px;`;
	if (t.mode === 'light') return `${selector}{${shared}${paletteVars(t.light)}color-scheme:light}`;
	if (t.mode === 'dark') return `${selector}{${shared}${paletteVars(t.dark)}color-scheme:dark}`;
	return (
		`${selector}{${shared}${paletteVars(t.light)}color-scheme:light dark}` +
		`@media (prefers-color-scheme: dark){${selector}{${paletteVars(t.dark)}}}`
	);
}

export function googleFontsHref(t: Theme): string | null {
	const fams = [...new Set([t.fonts.display, t.fonts.heading, t.fonts.body])].filter((f) => !SYSTEM_FONTS[f]);
	if (!fams.length) return null;
	const q = fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`).join('&');
	return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

function luminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
	if (!HEX.test(a) || !HEX.test(b)) return 1;
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
}

/** The pairs the UI actually draws, with the WCAG minimum each needs. */
export function contrastChecks(p: Palette): { label: string; ratio: number; min: number }[] {
	return [
		{ label: 'Text on background', ratio: contrast(p.ink, p.bg), min: 4.5 },
		{ label: 'Muted text on background', ratio: contrast(p.muted, p.bg), min: 4.5 },
		{ label: 'Accent links on background', ratio: contrast(p.accent, p.bg), min: 4.5 },
		{ label: 'Button text on accent', ratio: contrast(p.accentInk, p.accent), min: 4.5 },
		{ label: 'Text on surface', ratio: contrast(p.ink, p.surface), min: 4.5 },
		{ label: 'Down vs. degraded', ratio: contrast(p.down, p.degraded), min: 1.3 },
		{ label: 'Down bars on background', ratio: contrast(p.down, p.bg), min: 3 },
		{ label: 'Up bars on background', ratio: contrast(p.up, p.bg), min: 3 }
	];
}
