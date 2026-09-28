import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Heartbeat endpoint for "Push" monitors: have the job hit this URL when it runs. */
const ping: RequestHandler = async ({ platform, params }) => {
	const db = platform!.env.DB;
	const now = Math.floor(Date.now() / 1000);
	const m = await db
		.prepare("SELECT id FROM monitors WHERE push_token = ? AND type = 'push'")
		.bind(params.token)
		.first<{ id: number }>();
	if (!m) return json({ ok: false, error: 'Unknown push token' }, { status: 404 });
	await db
		.prepare(
			'INSERT INTO monitor_state (monitor_id, last_push_at) VALUES (?1, ?2) ON CONFLICT (monitor_id) DO UPDATE SET last_push_at = ?2'
		)
		.bind(m.id, now)
		.run();
	return json({ ok: true });
};

export const GET = ping;
export const POST = ping;
export const HEAD = ping;
