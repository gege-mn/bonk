import { error, redirect, type Handle } from '@sveltejs/kit';
import { authMode, checkSession, SESSION_COOKIE, verifyAccess } from '$lib/server/auth';
import { findPage } from '$lib/server/pages';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.admin = null;
	event.locals.page = null;
	let path = event.url.pathname;
	try {
		path = decodeURI(path);
	} catch {
		error(400, 'Bad path');
	}

	// Routing matches the decoded path (e.g. /%61dmin → /admin), so gate on that and on the route itself.
	const under = (p: string | null | undefined, root: string) => p === root || !!p?.startsWith(`${root}/`);
	let gated = under(path, '/admin') || under(event.route.id, '/admin');

	// Everything under [[slug]] belongs to one status page: the page itself, its incidents, logo and JSON.
	// A private page takes the same sign-in as the admin, decided here so no route can forget to ask.
	if (under(event.route.id, '/[[slug]]')) {
		const slug = event.params.slug;
		// /admin/logo and the like match [[slug]] with slug "admin", which is never a page.
		const pg = gated ? null : await findPage(event.platform!.env.DB, slug);
		if (!pg) error(404, 'Not Found');
		// The default page lives at /; its slug is only kept so it has an address if another page takes over.
		if (slug && pg.is_default) redirect(307, (path.slice(slug.length + 1) || '/') + event.url.search);
		event.locals.page = pg;
		gated = !pg.public;
	}

	if (gated) {
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
	if (gated) {
		response.headers.set('cache-control', 'no-store');
		response.headers.set('x-robots-tag', 'noindex');
		// A public page may be embedded; the admin and private pages may not.
		response.headers.set('x-frame-options', 'DENY');
	}
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-content-type-options', 'nosniff');
	return response;
};
