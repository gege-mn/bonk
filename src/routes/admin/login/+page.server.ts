import { fail, redirect } from '@sveltejs/kit';
import { authMode, clearAttempts, makeSession, passwordMatches, registerAttempt, SESSION_COOKIE } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

const safeNext = (n: string | null) => (n && /^\/(admin|private)(\/|\?|$)/.test(n) ? n : '/admin');

export const load: PageServerLoad = async ({ platform, locals, url }) => {
	if (authMode(platform!.env) !== 'password' || locals.admin) redirect(303, safeNext(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform, cookies, getClientAddress, url }) => {
		const env = platform!.env;
		const ip = request.headers.get('cf-connecting-ip') ?? getClientAddress();
		if (await registerAttempt(env.DB, ip)) {
			return fail(429, { error: 'Too many attempts. Try again in 15 minutes.' });
		}
		const fd = await request.formData();
		if (!(await passwordMatches(env, String(fd.get('password') ?? '')))) {
			return fail(400, { error: 'Wrong password.' });
		}
		await clearAttempts(env.DB, ip);
		const s = await makeSession(env);
		cookies.set(SESSION_COOKIE, s.value, { path: '/', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', maxAge: s.maxAge });
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
