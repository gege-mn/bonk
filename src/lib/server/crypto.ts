const PREFIX = 'enc:v1:';
const enc = new TextEncoder();
const dec = new TextDecoder();

const keyCache = new Map<string, Promise<CryptoKey>>();

function aesKey(secret: string): Promise<CryptoKey> {
	let k = keyCache.get(secret);
	if (!k) {
		k = crypto.subtle
			.digest('SHA-256', enc.encode(`bonk:enc:${secret}`))
			.then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
		keyCache.set(secret, k);
	}
	return k;
}

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Without a key the value is stored as-is; the settings page warns about it. */
export async function seal(value: string, secret: string | undefined): Promise<string> {
	if (!secret || value === '') return value;
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(value));
	return `${PREFIX}${b64(iv)}:${b64(ct)}`;
}

export async function open(value: string, secret: string | undefined): Promise<string> {
	if (!value.startsWith(PREFIX)) return value;
	if (!secret) throw new Error('ENCRYPTION_KEY is missing, so saved credentials cannot be read');
	const [iv, ct] = value.slice(PREFIX.length).split(':');
	try {
		const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(secret), unb64(ct));
		return dec.decode(pt);
	} catch {
		throw new Error('Could not decrypt a saved credential. Was ENCRYPTION_KEY changed?');
	}
}

export const isSealed = (v: unknown) => typeof v === 'string' && v.startsWith(PREFIX);

export async function hmac(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
	return b64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compares via HMAC so timing doesn't leak how much of a secret matched. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
	const k = crypto.getRandomValues(new Uint8Array(16)).join(',');
	return (await hmac(k, a)) === (await hmac(k, b));
}

export function randomToken(bytes = 18): string {
	return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
