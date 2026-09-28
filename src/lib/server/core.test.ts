import { describe, expect, it } from 'vitest';
import { parseHostPort, readPath } from './checks';
import { open, seal } from './crypto';
import { checkSvg, normalizeSite } from './settings';
import { appendRecent, applyResult, barStatus, decodeRecent, formatPct, parseExpected, RECENT_MAX, shouldAlert } from './status';
import { contrast, DEFAULT_THEME, normalizeTheme, themeCss } from '../theme';
import { headline } from '../headline';

describe('parseExpected', () => {
	it('handles classes, ranges and lists', () => {
		expect(parseExpected('2xx')(204)).toBe(true);
		expect(parseExpected('2xx')(301)).toBe(false);
		expect(parseExpected('200-299, 301')(301)).toBe(true);
		expect(parseExpected('')(200)).toBe(true);
		expect(() => parseExpected('abc')).toThrow();
	});
});

describe('applyResult', () => {
	const base = { status: 'up' as const, since: 0, streak_status: 'up' as const, streak: 5 };

	it('needs N failures in a row before confirming down', () => {
		let s: Parameters<typeof applyResult>[0] = base;
		const r1 = applyResult(s, 'down', 3, 10);
		expect(r1.status).toBe('up');
		expect(r1.transition).toBeNull();
		s = r1;
		const r2 = applyResult(s, 'down', 3, 20);
		expect(r2.status).toBe('up');
		const r3 = applyResult(r2, 'down', 3, 30);
		expect(r3.status).toBe('down');
		expect(r3.transition).toEqual({ from: 'up', to: 'down' });
		expect(r3.since).toBe(30);
	});

	it('recovers on the first success', () => {
		const r = applyResult({ status: 'down', since: 5, streak_status: 'down', streak: 9 }, 'up', 3, 50);
		expect(r.transition).toEqual({ from: 'down', to: 'up' });
	});

	it('a blip in the middle resets the streak', () => {
		const a = applyResult(base, 'down', 2, 1);
		const b = applyResult(a, 'up', 2, 2);
		const c = applyResult(b, 'down', 2, 3);
		expect(c.status).toBe('up');
	});

	it('pending → up is not alert-worthy, pending → down is', () => {
		const p = { status: 'pending' as const, since: null, streak_status: null, streak: 0 };
		const up = applyResult(p, 'up', 3, 1);
		expect(up.transition && shouldAlert(up.transition)).toBe(false);
		const down = applyResult(p, 'down', 1, 1);
		expect(down.transition && shouldAlert(down.transition)).toBe(true);
	});

	it('escalates degraded → down', () => {
		const r = applyResult({ status: 'degraded', since: 1, streak_status: 'degraded', streak: 4 }, 'down', 1, 9);
		expect(r.transition).toEqual({ from: 'degraded', to: 'down' });
	});
});

describe('recent buffer', () => {
	it('round-trips and caps length', () => {
		let s = '';
		for (let i = 0; i < RECENT_MAX + 10; i++) s = appendRecent(s, { ts: i, result: i % 2 ? 'up' : 'down', latency: i % 3 ? i : null });
		const list = decodeRecent(s);
		expect(list).toHaveLength(RECENT_MAX);
		expect(list.at(-1)).toEqual({ ts: RECENT_MAX + 9, result: 'up', latency: null });
		expect(list.at(-2)).toEqual({ ts: RECENT_MAX + 8, result: 'down', latency: RECENT_MAX + 8 });
		expect(list[0].ts).toBe(10);
	});
});

describe('bars and percentages', () => {
	it('keeps a stray failure from painting the day red', () => {
		expect(barStatus({ n: 1440, deg: 0, down: 1 })).toBe('degraded');
		expect(barStatus({ n: 1440, deg: 0, down: 30 })).toBe('down');
		expect(barStatus({ n: 0, deg: 0, down: 0 })).toBe('none');
	});
	it('never rounds up to 100%', () => {
		expect(formatPct(99.999)).toBe('100%');
		expect(formatPct(99.989)).toBe('99.98%');
		expect(formatPct(null)).toBe('—');
	});
});

describe('check helpers', () => {
	it('reads JSON paths', () => {
		const d = { data: { items: [{ ok: true }] }, status: 'ok' };
		expect(readPath(d, 'status')).toBe('ok');
		expect(readPath(d, '$.data.items[0].ok')).toBe(true);
		expect(readPath(d, 'nope.x')).toBeUndefined();
	});
	it('parses host:port', () => {
		expect(parseHostPort('example.com:22')).toEqual({ hostname: 'example.com', port: 22 });
		expect(parseHostPort('[::1]:8080')).toEqual({ hostname: '::1', port: 8080 });
		expect(() => parseHostPort('example.com')).toThrow();
	});
});

describe('crypto', () => {
	it('seals and opens', async () => {
		const sealed = await seal('bot-token', 'k1');
		expect(sealed.startsWith('enc:v1:')).toBe(true);
		expect(await open(sealed, 'k1')).toBe('bot-token');
		await expect(open(sealed, 'k2')).rejects.toThrow(/ENCRYPTION_KEY/);
		expect(await seal('plain', undefined)).toBe('plain');
	});
});

describe('theme', () => {
	it('rejects anything that is not a hex color or a plain font name', () => {
		const t = normalizeTheme({
			preset: 'gege',
			light: { bg: 'red;}</style><script>', ink: '#000000' },
			fonts: { display: 'Evil"; }', body: 'IBM Plex Mono' }
		});
		expect(t.light.bg).toBe(DEFAULT_THEME.light.bg);
		expect(t.light.ink).toBe('#000000');
		expect(t.fonts.display).toBe(DEFAULT_THEME.fonts.display);
		expect(t.fonts.body).toBe('IBM Plex Mono');
		expect(themeCss(t)).not.toMatch(/<|script/);
	});
	it('default theme passes its own contrast bar', () => {
		const p = DEFAULT_THEME.light;
		expect(contrast(p.ink, p.bg)).toBeGreaterThan(4.5);
		expect(contrast(p.muted, p.bg)).toBeGreaterThan(4.5);
		expect(contrast(p.accentInk, p.accent)).toBeGreaterThan(4.5);
	});
	it('system mode emits a dark media query', () => {
		expect(themeCss({ ...DEFAULT_THEME, mode: 'system' })).toContain('prefers-color-scheme: dark');
	});
});

describe('settings', () => {
	it('blocks scripted SVGs', () => {
		expect(checkSvg('<svg><script>alert(1)</script></svg>')).not.toBeNull();
		expect(checkSvg('<svg onload="x()"></svg>')).not.toBeNull();
		expect(checkSvg('<svg><image href="https://evil/x.png"/></svg>')).not.toBeNull();
		expect(checkSvg('<svg viewBox="0 0 10 10"><use href="#a"/><path d="M0 0"/></svg>')).toBeNull();
	});
	it('drops unsafe links', () => {
		const s = normalizeSite({ name: 'X', links: [{ label: 'a', href: 'javascript:alert(1)' }, { label: 'b', href: 'https://ok' }] });
		expect(s.links).toEqual([{ label: 'b', href: 'https://ok' }]);
	});
});

describe('headline', () => {
	it('names the single broken service', () => {
		expect(headline([{ name: 'API', status: 'down' }, { name: 'Web', status: 'up' }], [], false).title).toBe('API is down');
	});
	it('prefers an open incident title', () => {
		expect(headline([{ name: 'API', status: 'down' }], [{ title: 'Payments delayed', severity: 'down' }], false).title).toBe('Payments delayed');
	});
	it('says all good when all good', () => {
		expect(headline([{ name: 'API', status: 'up' }], [], false).title).toBe('All systems operational');
	});
});
