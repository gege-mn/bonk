import { describe, expect, it } from 'vitest';
import { parseHostPort, readPath } from './checks';
import { open, seal } from './crypto';
import { recountUnconfirmed, emptyState } from './engine';
import { isBlip } from './repo';
import { checkSvg, normalizeRules, normalizeSite } from './settings';
import {
	appendRecent,
	applyResult,
	barStatus,
	decodeRecent,
	formatPct,
	minBadChecks,
	parseExpected,
	RECENT_MAX,
	shouldAlert,
	tallyResult,
	unconfirmedByHour
} from './status';
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
	it('leaves a day green until failures add up to the minimum', () => {
		const min = minBadChecks(5, 60);
		expect(min).toBe(5);
		expect(barStatus({ n: 1440, deg: 0, down: 3 }, min)).toBe('up');
		expect(barStatus({ n: 1440, deg: 0, down: 5 }, min)).toBe('degraded');
		expect(barStatus({ n: 1440, deg: 0, down: 30 }, min)).toBe('down');
		expect(barStatus({ n: 1440, deg: 4, down: 0 }, min)).toBe('up');
		expect(barStatus({ n: 1440, deg: 5, down: 0 }, min)).toBe('degraded');
		// Failed and slow checks add up together.
		expect(barStatus({ n: 1440, deg: 3, down: 2 }, min)).toBe('degraded');
		expect(barStatus({ n: 1440, deg: 2, down: 2 }, min)).toBe('up');
	});
	it('turns minutes into checks for any interval', () => {
		expect(minBadChecks(5, 300)).toBe(1);
		expect(minBadChecks(5, 120)).toBe(3);
		expect(minBadChecks(0, 60)).toBe(1);
	});
	it('never rounds up to 100%', () => {
		expect(formatPct(99.999)).toBe('100%');
		expect(formatPct(99.989)).toBe('99.98%');
		expect(formatPct(null)).toBe('—');
	});
});

describe('confirmed-only totals', () => {
	it('counts a failure only while the monitor is confirmed failing', () => {
		expect(tallyResult('up', 'down')).toBe('up');
		expect(tallyResult('up', 'degraded')).toBe('up');
		expect(tallyResult('pending', 'down')).toBe('up');
		expect(tallyResult('down', 'down')).toBe('down');
		expect(tallyResult('down', 'degraded')).toBe('degraded');
		expect(tallyResult('up', 'up')).toBe('up');
	});

	it('a blip shorter than alert_after never reaches the totals', () => {
		let s: Parameters<typeof applyResult>[0] = { status: 'up', since: 0, streak_status: 'up', streak: 9 };
		const tallied = (['degraded', 'degraded', 'up'] as const).map((r, i) => {
			const next = applyResult(s, r, 3, i);
			s = next;
			return tallyResult(next.status, r);
		});
		expect(tallied).toEqual(['up', 'up', 'up']);
	});

	it('groups the checks before a confirmation by hour', () => {
		const recent = [3500, 3560, 3620, 3680].map((ts) => ({ ts, result: 'down' as const, latency: null }));
		expect([...unconfirmedByHour(recent, 3)]).toEqual([
			[0, 1],
			[3600, 2]
		]);
		expect(unconfirmedByHour(recent, 0).size).toBe(0);
	});

	it('recounts the running hour in place and older hours with statements', () => {
		const binds: unknown[][] = [];
		const db = { prepare: () => ({ bind: (...a: unknown[]) => (binds.push(a), {}) }) } as unknown as D1Database;
		const s = { ...emptyState(7), h_start: 3600, h_n: 2, h_up: 2 };
		const stmts = recountUnconfirmed(db, s, '3560:x:;3620:x:', 2, 'down');
		expect([s.h_up, s.h_down]).toEqual([1, 1]);
		expect(stmts).toHaveLength(2);
		expect(binds).toEqual([
			[1, 7, 0],
			[1, 7, 0]
		]);
	});
});

describe('short incidents', () => {
	const rules = normalizeRules({ minIncidentMin: 5 });
	it('hides automatic incidents that cleared quickly', () => {
		expect(isBlip({ auto: 1, started_at: 0, resolved_at: 60 }, rules)).toBe(true);
		expect(isBlip({ auto: 1, started_at: 0, resolved_at: 300 }, rules)).toBe(false);
	});
	it('never hides open or hand-written incidents', () => {
		expect(isBlip({ auto: 1, started_at: 0, resolved_at: null }, rules)).toBe(false);
		expect(isBlip({ auto: 0, started_at: 0, resolved_at: 60 }, rules)).toBe(false);
	});
	it('defaults to five minutes and clamps the setting', () => {
		expect(normalizeRules(null).minIncidentMin).toBe(5);
		expect(normalizeRules({ minIncidentMin: '0' }).minIncidentMin).toBe(0);
		expect(normalizeRules({ minIncidentMin: '' }).minIncidentMin).toBe(5);
		expect(normalizeRules({ minIncidentMin: 99999 }).minIncidentMin).toBe(1440);
		expect(normalizeRules({ minIncidentMin: 'abc' }).minIncidentMin).toBe(5);
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
