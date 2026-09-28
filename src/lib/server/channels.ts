import { fail } from '@sveltejs/kit';
import { channelConfig } from './engine';
import { seal } from './crypto';
import { getProvider, providers, sendAlert, type Alert } from './notify';
import { plainText } from './notify/format';
import { getSetting, normalizeSite } from './settings';
import type { BonkEnv, Channel } from './types';

/** Everything the browser needs to render a provider's form — never `send`. */
export const providerMeta = () =>
	providers.map((p) => ({ id: p.id, name: p.name, mono: p.mono, category: p.category, docs: p.docs ?? null, fields: p.fields }));

/** Blank secret fields keep the stored value, so editing never forces re-entering a token. */
export async function readChannelForm(fd: FormData, env: BonkEnv, existing: Channel | null) {
	const provider = getProvider(String(fd.get('provider') ?? existing?.provider ?? ''));
	if (!provider) return { error: 'Pick a service.' } as const;
	const name = String(fd.get('name') ?? '').trim().slice(0, 60) || provider.name;
	const old = existing ? (JSON.parse(existing.config || '{}') as Record<string, string | boolean>) : {};
	const config: Record<string, string | boolean> = {};
	const errors: Record<string, string> = {};
	for (const f of provider.fields) {
		if (f.type === 'checkbox') {
			config[f.key] = fd.get(`f_${f.key}`) === 'on';
			continue;
		}
		const raw = String(fd.get(`f_${f.key}`) ?? '').trim().slice(0, 4000);
		if (f.secret && !raw && old[f.key]) {
			config[f.key] = old[f.key];
			continue;
		}
		if (f.required && !raw) errors[f.key] = `${f.label} is required.`;
		config[f.key] = f.secret && raw ? await seal(raw, env.ENCRYPTION_KEY) : raw;
	}
	return { provider, name, config, errors, defaultOn: fd.get('default_on') === 'on' ? 1 : 0 } as const;
}

/** Secret values never go back to the browser; only whether one is set. */
export function publicConfig(ch: Channel) {
	const provider = getProvider(ch.provider);
	const cfg = JSON.parse(ch.config || '{}') as Record<string, string | boolean>;
	const out: Record<string, string | boolean> = {};
	for (const f of provider?.fields ?? []) {
		out[f.key] = f.secret ? (cfg[f.key] ? '__set__' : '') : (cfg[f.key] ?? '');
	}
	return out;
}

export async function sampleAlert(env: BonkEnv, kind: Alert['kind'] = 'test'): Promise<Alert> {
	const site = normalizeSite(await getSetting(env.DB, 'site'));
	const now = Math.floor(Date.now() / 1000);
	return {
		kind,
		monitor: { id: 0, name: kind === 'test' ? 'Test alert' : 'Example API', target: 'https://example.com/health' },
		from: kind === 'test' ? 'up' : 'up',
		to: kind === 'test' ? 'up' : 'down',
		reason: kind === 'test' ? `If you can read this, ${site.name} can reach you here.` : 'HTTP 502 Bad Gateway',
		at: now,
		siteName: site.name,
		link: site.url ? `${site.url}/admin` : undefined
	};
}

export async function previewText(env: BonkEnv) {
	return plainText(await sampleAlert(env, 'down'));
}

export async function testChannel(env: BonkEnv, ch: Channel) {
	try {
		await sendAlert(ch.provider, await channelConfig(ch, env.ENCRYPTION_KEY), await sampleAlert(env));
		return { tested: ch.id, testOk: true, testError: null };
	} catch (e) {
		return fail(502, { tested: ch.id, testOk: false, testError: e instanceof Error ? e.message : String(e) });
	}
}
