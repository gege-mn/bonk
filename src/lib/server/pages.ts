import { DEFAULT_THEME, normalizeTheme, type Theme } from '../theme';

export interface PageLink {
	label: string;
	href: string;
}

/** A status page without its logo bytes, which only the logo route reads. */
export interface PageRow {
	id: number;
	slug: string;
	name: string;
	description: string;
	/** JSON array of PageLink. */
	links: string;
	public: number;
	is_default: number;
	/** JSON theme; NULL follows the site theme. */
	theme: string | null;
	has_logo: number;
	logo_version: number;
	created_at: number;
}

export const PAGE_COLUMNS =
	'id, slug, name, description, links, public, is_default, theme, logo IS NOT NULL AS has_logo, logo_version, created_at';

/** First path segments that belong to other routes, so no page may claim them. */
export const RESERVED_SLUGS = ['admin', 'api', 'brand', 'incidents', 'logo', 'cdn-cgi'];

const SLUG = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/** Returns what's wrong with a slug, or null when it's usable. */
export function slugProblem(slug: string): string | null {
	if (!SLUG.test(slug)) return 'Use 1 to 40 lowercase letters, digits and dashes, e.g. internal-tools.';
	if (RESERVED_SLUGS.includes(slug)) return `“${slug}” is taken by Bonk itself. Pick another.`;
	return null;
}

export function normalizeLinks(input: unknown): PageLink[] {
	const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
	if (!Array.isArray(input)) return [];
	return input
		.map((l) => ({ label: str(l?.label, 40), href: str(l?.href, 300) }))
		.filter((l) => l.label && /^(https?:|mailto:)/.test(l.href))
		.slice(0, 5);
}

function parseJson(text: string | null): unknown {
	try {
		return text ? JSON.parse(text) : null;
	} catch {
		return null;
	}
}

export const pageLinks = (p: Pick<PageRow, 'links'>) => normalizeLinks(parseJson(p.links));

/** A page's own theme, or the site's when it hasn't set one. */
export const pageTheme = (p: Pick<PageRow, 'theme'>, site: Theme = DEFAULT_THEME): Theme => (p.theme ? normalizeTheme(parseJson(p.theme)) : site);

/** Path prefix of a page: '' for the default page at /, otherwise /<slug>. */
export const pageBase = (p: Pick<PageRow, 'slug' | 'is_default'>) => (p.is_default ? '' : `/${p.slug}`);

/** Where a page's logo is served. The image bakes in the theme's ink color, so the version covers the theme too. */
export function pageLogoUrl(p: Pick<PageRow, 'slug' | 'is_default' | 'theme' | 'has_logo' | 'logo_version'>, site: { theme: Theme; logoVersion: number }) {
	let h = 0;
	for (const c of JSON.stringify(pageTheme(p, site.theme))) h = (h * 31 + c.charCodeAt(0)) | 0;
	return `${pageBase(p)}/logo?v=${p.has_logo ? p.logo_version : site.logoVersion}.${(h >>> 0).toString(36)}`;
}

/** The page for a URL slug; no slug means the default page. */
export async function findPage(db: D1Database, slug: string | undefined): Promise<PageRow | null> {
	const q = slug
		? db.prepare(`SELECT ${PAGE_COLUMNS} FROM pages WHERE slug = ?`).bind(slug)
		: db.prepare(`SELECT ${PAGE_COLUMNS} FROM pages WHERE is_default = 1`);
	return q.first<PageRow>();
}

export async function listPages(db: D1Database): Promise<(PageRow & { monitors: number })[]> {
	const { results } = await db
		.prepare(
			`SELECT ${PAGE_COLUMNS}, (SELECT count(*) FROM page_monitors pm WHERE pm.page_id = pages.id) AS monitors
			FROM pages ORDER BY is_default DESC, name COLLATE NOCASE, id`
		)
		.all<PageRow & { monitors: number }>();
	return results;
}

export interface PageInput {
	slug: string;
	name: string;
	description: string;
	links: PageLink[];
	public: number;
}

/** Fields: name, slug, description, link_label[] + link_href[], public (checkbox). */
export function parsePageForm(fd: FormData): { values: PageInput; errors: Record<string, string> } {
	const str = (k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
	const labels = fd.getAll('link_label').map(String);
	const hrefs = fd.getAll('link_href').map(String);
	const values: PageInput = {
		slug: str('slug', 60).toLowerCase(),
		name: str('name', 60),
		description: str('description', 300),
		links: normalizeLinks(labels.map((label, i) => ({ label, href: hrefs[i] ?? '' }))),
		public: fd.get('public') === 'on' ? 1 : 0
	};
	const errors: Record<string, string> = {};
	if (!values.name) errors.name = 'Give the page a name.';
	const bad = slugProblem(values.slug);
	if (bad) errors.slug = bad;
	return { values, errors };
}

export interface PageMonitorInput {
	monitor_id: number;
	group_name: string;
	display_name: string | null;
}

/**
 * The monitor picker posts one JSON array, already in display order:
 * [{ monitor_id, group_name, display_name }]. Unknown and repeated monitors are dropped.
 */
export function parsePageMonitors(raw: string, known: Set<number>): PageMonitorInput[] | null {
	const list = parseJson(raw);
	if (!Array.isArray(list)) return null;
	const seen = new Set<number>();
	const out: PageMonitorInput[] = [];
	for (const r of list) {
		const id = Number(r?.monitor_id);
		if (!known.has(id) || seen.has(id)) continue;
		seen.add(id);
		const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
		out.push({ monitor_id: id, group_name: text(r.group_name, 60), display_name: text(r.display_name, 80) || null });
	}
	return out;
}

/** Replaces a page's monitors; `sort` is the position in the list. */
export function setPageMonitorsStmts(db: D1Database, pageId: number, rows: PageMonitorInput[]): D1PreparedStatement[] {
	return [
		db.prepare('DELETE FROM page_monitors WHERE page_id = ?').bind(pageId),
		...rows.map((r, i) =>
			db
				.prepare('INSERT INTO page_monitors (page_id, monitor_id, group_name, sort, display_name) VALUES (?, ?, ?, ?, ?)')
				.bind(pageId, r.monitor_id, r.group_name, i, r.display_name)
		)
	];
}

/** Puts a monitor on exactly these pages: new ones get it at the end, ungrouped; the rest keep their place. */
export function setMonitorPagesStmts(db: D1Database, monitorId: number, pageIds: number[]): D1PreparedStatement[] {
	const ids = [...new Set(pageIds)].filter((n) => Number.isInteger(n) && n > 0);
	return [
		// An empty NOT IN () isn't valid SQL, and NOT IN (NULL) matches nothing, so 0 stands in for "no page".
		db
			.prepare(`DELETE FROM page_monitors WHERE monitor_id = ? AND page_id NOT IN (${ids.map(() => '?').join(',') || '0'})`)
			.bind(monitorId, ...ids),
		...ids.map((p) =>
			db
				.prepare(
					`INSERT INTO page_monitors (page_id, monitor_id, sort)
					SELECT id, ?2, (SELECT coalesce(max(sort) + 1, 0) FROM page_monitors WHERE page_id = ?1) FROM pages WHERE id = ?1
					ON CONFLICT (page_id, monitor_id) DO NOTHING`
				)
				.bind(p, monitorId)
		)
	];
}

/** Same idea for a monitor-less incident and the pages it's posted on. */
export function setIncidentPagesStmts(db: D1Database, incidentId: number, pageIds: number[]): D1PreparedStatement[] {
	const ids = [...new Set(pageIds)].filter((n) => Number.isInteger(n) && n > 0);
	return [
		db.prepare('DELETE FROM incident_pages WHERE incident_id = ?').bind(incidentId),
		...ids.map((p) =>
			db.prepare('INSERT INTO incident_pages (incident_id, page_id) SELECT ?1, id FROM pages WHERE id = ?2').bind(incidentId, p)
		)
	];
}
