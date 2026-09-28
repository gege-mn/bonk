import { json } from '@sveltejs/kit';
import { headline } from '$lib/headline';
import { publicStatus } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const s = await publicStatus(platform!.env.DB);
	const h = headline(s.monitors, s.openIncidents, s.maintenance.some((m) => m.active));
	return json(
		{
			status: h.status,
			summary: h.title,
			checkedAt: s.checkedAt,
			monitors: s.monitors.map((m) => ({
				id: m.id,
				name: m.name,
				group: m.group || null,
				status: m.status,
				uptime90d: m.uptime,
				days: m.bars.map((b) => ({ day: b.day, checks: b.n, failed: b.down, slow: b.deg, status: b.status }))
			})),
			incidents: s.openIncidents.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, startedAt: i.started_at }))
		},
		{ headers: { 'cache-control': 'public, max-age=30', 'access-control-allow-origin': '*' } }
	);
};
