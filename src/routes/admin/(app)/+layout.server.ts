import { authMode } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const env = platform!.env;
	const n = await env.DB.prepare(
		`SELECT (SELECT count(*) FROM monitors) AS n, (SELECT count(*) FROM monitors WHERE paused = 0) AS active,
		(SELECT max(s.last_check_at) FROM monitor_state s JOIN monitors m ON m.id = s.monitor_id WHERE m.paused = 0) AS last_run,
		(SELECT min(CASE WHEN type = 'push' THEN 60 ELSE interval_s END) FROM monitors WHERE paused = 0) AS every`
	).first<{ n: number; active: number; last_run: number | null; every: number | null }>();
	const now = Math.floor(Date.now() / 1000);
	return {
		// Cron Triggers can take a while to start after the first deploy, and occasionally stall.
		checkerStale: !!n?.active && (n.last_run === null || now - n.last_run > Math.max(180, (n.every ?? 60) + 120)),
		checkerLastRun: n?.last_run ?? null,
		admin: locals.admin,
		authMode: authMode(env),
		encryptionMissing: !env.ENCRYPTION_KEY,
		monitorCount: n?.n ?? 0
	};
};
