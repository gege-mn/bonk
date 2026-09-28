import { error, redirect, type Handle } from '@sveltejs/kit';
import { authMode, checkSession, SESSION_COOKIE, verifyAccess } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.admin = null;
	let path = event.url.pathname;
	try {
		path = decodeURI(path);
	} catch {
		error(400, 'Bad path');
	}

	// Routing matches the decoded path (e.g. /%61dmin → /admin), so gate on that and on the route itself.
	if (path === '/admin' || path.startsWith('/admin/') || event.route.id?.startsWith('/admin')) {
		const env = event.platform!.env;
		const mode = authMode(env);
		if (mode === 'access') {
			try {
				const email = await verifyAccess(env, event.request, event.cookies.get('CF_Authorization'));
				event.locals.admin = { email, via: 'access' };
			} catch (e) {
				error(403, `Cloudflare Access check failed: ${e instanceof Error ? e.message : 'invalid token'}`);
			}
		} else if (mode === 'password') {
			if (await checkSession(env, event.cookies.get(SESSION_COOKIE))) {
				event.locals.admin = { email: null, via: 'password' };
			} else if (path !== '/admin/login') {
				redirect(303, `/admin/login?next=${encodeURIComponent(path + event.url.search)}`);
			}
		} else if (path !== '/admin/setup') {
			redirect(303, '/admin/setup');
		}
	}

	const response = await resolve(event);
	if (path.startsWith('/admin')) {
		response.headers.set('cache-control', 'no-store');
		response.headers.set('x-robots-tag', 'noindex');
		// The public page may be embedded; the admin may not.
		response.headers.set('x-frame-options', 'DENY');
	}
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-content-type-options', 'nosniff');
	return response;
};
