import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hmac, safeEqual } from './crypto';
import type { BonkEnv } from './types';

export type AuthMode = 'access' | 'password' | 'unconfigured';

export const SESSION_COOKIE = 'bonk_session';
const SESSION_DAYS = 30;
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60;

export function authMode(env: BonkEnv): AuthMode {
	if (env.CF_TEAM_DOMAIN?.trim() && env.CF_AUD_TOKEN?.trim()) return 'access';
	if (env.ADMIN_PASSWORD) return 'password';
	return 'unconfigured';
}

function teamIssuer(domain: string): string {
	const d = domain.trim().replace(/\/+$/, '');
	return /^https?:\/\//.test(d) ? d : `https://${d.includes('.') ? d : `${d}.cloudflareaccess.com`}`;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Returns the signed-in email, or throws with a reason. */
export async function verifyAccess(env: BonkEnv, request: Request, cookie: string | undefined): Promise<string | null> {
	const token = request.headers.get('cf-access-jwt-assertion') ?? cookie;
	if (!token) throw new Error('This request did not come through Cloudflare Access.');
	const issuer = teamIssuer(env.CF_TEAM_DOMAIN!);
	let jwks = jwksCache.get(issuer);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
		jwksCache.set(issuer, jwks);
	}
	const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.CF_AUD_TOKEN!.trim() });
	return typeof payload.email === 'string' ? payload.email : null;
}

const sessionKey = (env: BonkEnv) => `bonk-session:${env.ADMIN_PASSWORD}`;

export async function makeSession(env: BonkEnv, now = Math.floor(Date.now() / 1000)) {
	const exp = now + SESSION_DAYS * 86400;
	return { value: `${exp}.${await hmac(sessionKey(env), `session:${exp}`)}`, maxAge: SESSION_DAYS * 86400 };
}

/** Sessions are signed with the password itself, so changing it signs everyone out. */
export async function checkSession(env: BonkEnv, value: string | undefined, now = Math.floor(Date.now() / 1000)) {
	if (!value || !env.ADMIN_PASSWORD) return false;
	const [expStr, sig] = value.split('.');
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || exp < now || !sig) return false;
	return safeEqual(sig, await hmac(sessionKey(env), `session:${exp}`));
}

/** IPv6 clients get a whole /64 each, so rotating inside it must not reset the limit. */
export function ipKey(ip: string): string {
	return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip;
}

/** Records the attempt first and then counts, so a parallel burst can't all slip under the limit. */
export async function registerAttempt(db: D1Database, ip: string, now = Math.floor(Date.now() / 1000)) {
	const key = ipKey(ip);
	const [, count] = await db.batch([
		db.prepare('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)').bind(key, now),
		db.prepare('SELECT count(*) AS n FROM login_attempts WHERE ip = ? AND ts > ?').bind(key, now - FAIL_WINDOW)
	]);
	return ((count.results[0] as { n: number } | undefined)?.n ?? 0) > MAX_FAILS;
}

export async function clearAttempts(db: D1Database, ip: string) {
	await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ipKey(ip)).run();
}

export async function passwordMatches(env: BonkEnv, attempt: string) {
	return !!env.ADMIN_PASSWORD && (await safeEqual(attempt, env.ADMIN_PASSWORD));
}
