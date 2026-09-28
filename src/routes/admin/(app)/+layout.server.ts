import { authMode } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const env = platform!.env;
	const n = await env.DB.prepare('SELECT count(*) AS n FROM monitors').first<{ n: number }>();
	return {
		admin: locals.admin,
		authMode: authMode(env),
		encryptionMissing: !env.ENCRYPTION_KEY,
		monitorCount: n?.n ?? 0
	};
};
