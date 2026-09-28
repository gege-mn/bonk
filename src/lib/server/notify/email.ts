import { list, need } from './format';
import type { ProviderConfig } from './types';

/** Parses "Name <a@b.c>" or "a@b.c". */
export function parseAddress(raw: string): { email: string; name?: string } {
	const m = /^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(raw);
	const out = m ? { email: m[2], name: m[1].replace(/^"|"$/g, '') || undefined } : { email: raw.trim() };
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) throw new Error(`"${raw}" is not a valid email address`);
	return out;
}

export function recipients(config: ProviderConfig, key = 'to'): string[] {
	const to = list(need(config, key, 'To'));
	if (!to.length) throw new Error('To is required');
	to.forEach(parseAddress);
	return to;
}

export const fromField = {
	key: 'from',
	label: 'From',
	type: 'text',
	required: true,
	placeholder: 'Bonk <alerts@example.com>',
	help: 'Must be on a domain verified with the provider.'
} as const;

export const toField = {
	key: 'to',
	label: 'To',
	type: 'text',
	required: true,
	placeholder: 'you@example.com, team@example.com',
	help: 'Comma-separated.'
} as const;
