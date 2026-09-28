import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert } from './types';
import {
	color,
	colorInt,
	escapeHtml,
	escapeMarkdown,
	lines,
	markdown,
	plainText,
	post,
	severity,
	title
} from './format';
import { getProvider, providers, sendAlert } from './index';
import { dingtalkSign } from './providers/dingtalk';
import { feishuSign } from './providers/feishu';

const at = Date.UTC(2026, 8, 21, 9, 12, 30) / 1000;

function alert(over: Partial<Alert> = {}): Alert {
	return {
		kind: 'down',
		monitor: { id: 7, name: 'Sonor API', target: 'https://api.sonor.mn/health' },
		from: 'up',
		to: 'down',
		reason: 'HTTP 502 Bad Gateway',
		at,
		link: 'https://status.example.com/admin/monitors/7',
		siteName: 'gege status',
		...over
	};
}

type FetchMock = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

function stubFetch(status = 200, body = '{"ok":true}'): FetchMock {
	const fn = vi.fn(async (_url: string, _init: RequestInit) => new Response(body, { status }));
	vi.stubGlobal('fetch', fn);
	return fn;
}

function call(fn: FetchMock, i = 0) {
	const [url, init] = fn.mock.calls[i];
	const raw = init.body;
	const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
	return { url: String(url), init, body, headers: init.headers as Record<string, string> };
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('format', () => {
	it('titles every kind', () => {
		expect(title(alert())).toBe('Down · Sonor API');
		expect(title(alert({ kind: 'degraded', to: 'degraded' }))).toBe('Degraded · Sonor API');
		expect(title(alert({ kind: 'up', from: 'down', to: 'up' }))).toBe('Recovered · Sonor API');
		expect(title(alert({ kind: 'reminder', from: 'down', to: 'down' }))).toBe('Still down · Sonor API');
		expect(title(alert({ kind: 'reminder', from: 'degraded', to: 'degraded' }))).toBe('Still degraded · Sonor API');
		expect(title(alert({ kind: 'test' }))).toBe('Test · Bonk');
	});

	it('builds lines with duration, UTC time and link', () => {
		expect(lines(alert({ kind: 'up', from: 'down', to: 'up', reason: 'HTTP 200', downFor: 372 }))).toEqual([
			'HTTP 200',
			'https://api.sonor.mn/health',
			'Was down for 6 min',
			'2026-09-21 09:12 UTC',
			'https://status.example.com/admin/monitors/7'
		]);
		expect(lines(alert({ downFor: 5400, from: 'degraded' }), { link: false })).toContain('Was degraded for 1 h 30 min');
		expect(lines(alert({ link: undefined, monitor: { id: 1, name: 'x', target: '' } }))).toEqual([
			'HTTP 502 Bad Gateway',
			'2026-09-21 09:12 UTC'
		]);
	});

	it('plain text and markdown', () => {
		expect(plainText(alert()).split('\n')[0]).toBe('Down · Sonor API');
		const md = markdown(alert({ reason: 'bad *stars* and _under_' }));
		expect(md.startsWith('**Down · Sonor API**\n')).toBe(true);
		expect(md).toContain('bad \\*stars\\* and \\_under\\_');
		expect(md).toContain('https://status.example.com/admin/monitors/7');
		expect(escapeMarkdown('https://a.b/c_d')).toBe('https://a.b/c_d');
	});

	it('escapes html', () => {
		expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
	});

	it('colors and severity follow the state', () => {
		expect(color(alert())).toBe('#e0461a');
		expect(colorInt(alert())).toBe(0xe0461a);
		expect(color(alert({ kind: 'degraded', to: 'degraded' }))).toBe('#d99a1e');
		expect(color(alert({ kind: 'up', to: 'up' }))).toBe('#2f9e44');
		expect(color(alert({ kind: 'test' }))).toBe('#6d28d9');
		expect(severity(alert())).toBe('critical');
		expect(severity(alert({ kind: 'reminder', to: 'degraded' }))).toBe('warning');
		expect(severity(alert({ kind: 'up', to: 'up' }))).toBe('info');
	});

	it('post throws on non-2xx with status and snippet', async () => {
		stubFetch(500, 'x'.repeat(500));
		await expect(post('https://example.com', {})).rejects.toThrow(/^HTTP 500: x{200}$/);
	});
});

describe('registry', () => {
	it('has unique ids, names, and secret passwords', () => {
		expect(providers.length).toBeGreaterThanOrEqual(25);
		const ids = providers.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(providers.map((p) => p.mono)).size).toBe(ids.length);
		for (const p of providers) {
			expect(p.name, p.id).toBeTruthy();
			expect(p.mono, p.id).toMatch(/^[A-Z0-9]{2}$/);
			const keys = p.fields.map((f) => f.key);
			expect(new Set(keys).size, p.id).toBe(keys.length);
			for (const f of p.fields) {
				if (f.type === 'password') expect(f.secret, `${p.id}.${f.key}`).toBe(true);
				if (f.type === 'select') expect(f.options?.length, `${p.id}.${f.key}`).toBeGreaterThan(0);
			}
		}
	});

	it('pins telegram and discord first, then alphabetical', () => {
		expect(providers[0].id).toBe('telegram');
		expect(providers[1].id).toBe('discord');
		const rest = providers.slice(2).map((p) => p.name.toLowerCase());
		expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'en')));
		expect(getProvider('slack')?.name).toBe('Slack');
		expect(getProvider('nope')).toBeUndefined();
	});

	it('sendAlert rejects unknown providers and reports missing config', async () => {
		stubFetch();
		await expect(sendAlert('nope', {}, alert())).rejects.toThrow(/Unknown/);
		for (const p of providers) {
			if (!p.fields.some((f) => f.required)) continue;
			await expect(p.send({}, alert()), p.id).rejects.toThrow(/required/);
		}
	});
});

describe('telegram', () => {
	const config = { botToken: '123456:ABC-def_GHI', chatId: '-1001234', threadId: '42', silent: true };

	it('sends HTML sendMessage', async () => {
		const fetch = stubFetch();
		await sendAlert('telegram', config, alert({ reason: 'HTTP 502 <b>Bad</b> & worse' }));
		const { url, body, init } = call(fetch);
		expect(init.method).toBe('POST');
		expect(url).toBe('https://api.telegram.org/bot123456:ABC-def_GHI/sendMessage');
		expect(body).toMatchObject({
			chat_id: '-1001234',
			parse_mode: 'HTML',
			message_thread_id: 42,
			disable_notification: true
		});
		expect(body.text).toContain('<b>Down · Sonor API</b>');
		expect(body.text).toContain('HTTP 502 &lt;b&gt;Bad&lt;/b&gt; &amp; worse');
		expect(body.text).toContain('<a href="https://status.example.com/admin/monitors/7">Open monitor</a>');
	});

	it('omits optional fields and throws on API errors', async () => {
		let fetch = stubFetch();
		await sendAlert('telegram', { botToken: '1:x', chatId: '5' }, alert());
		const { body } = call(fetch);
		expect(body.message_thread_id).toBeUndefined();
		expect(body.disable_notification).toBe(false);

		fetch = stubFetch(400, '{"ok":false,"description":"Bad Request: chat not found"}');
		await expect(sendAlert('telegram', { botToken: '1:x', chatId: '5' }, alert())).rejects.toThrow(
			/HTTP 400.*chat not found/
		);
	});
});

describe('discord', () => {
	const hook = 'https://discord.com/api/webhooks/123/abc';

	it('sends an embed and mentions only on down', async () => {
		const fetch = stubFetch();
		const config = { webhookUrl: hook, mention: '<@&999>', username: 'Bonk', avatarUrl: 'https://x/y.png' };
		await sendAlert('discord', config, alert());
		const { url, body } = call(fetch);
		expect(url).toBe(`${hook}?wait=true`);
		expect(body.content).toBe('<@&999>');
		expect(body.username).toBe('Bonk');
		expect(body.avatar_url).toBe('https://x/y.png');
		expect(body.embeds[0]).toMatchObject({
			title: 'Down · Sonor API',
			color: 0xe0461a,
			url: 'https://status.example.com/admin/monitors/7',
			timestamp: '2026-09-21T09:12:30.000Z'
		});
		expect(body.embeds[0].description).toContain('HTTP 502 Bad Gateway');

		await sendAlert('discord', config, alert({ kind: 'up', from: 'down', to: 'up', downFor: 60 }));
		const up = call(fetch, 1).body;
		expect(up.content).toBeUndefined();
		expect(up.allowed_mentions).toEqual({ parse: [] });
		expect(up.embeds[0].color).toBe(0x2f9e44);
		expect(up.embeds[0].description).toContain('Was down for 1 min');
	});

	it('rejects non-discord URLs and non-2xx', async () => {
		stubFetch();
		await expect(sendAlert('discord', { webhookUrl: 'https://evil.example/api/webhooks/1' }, alert())).rejects.toThrow(
			/discord\.com/
		);
		stubFetch(404, '{"message":"Unknown Webhook"}');
		await expect(sendAlert('discord', { webhookUrl: hook }, alert())).rejects.toThrow(/HTTP 404.*Unknown Webhook/);
	});
});

describe('pagerduty', () => {
	it('triggers, resolves and tests with dedup keys', async () => {
		const fetch = stubFetch(202, '{"status":"success"}');
		const config = { routingKey: 'R0UT1NG' };
		await sendAlert('pagerduty', config, alert());
		let { url, body } = call(fetch);
		expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
		expect(body).toMatchObject({
			routing_key: 'R0UT1NG',
			event_action: 'trigger',
			dedup_key: 'bonk-monitor-7',
			payload: { severity: 'critical', source: 'https://api.sonor.mn/health', timestamp: '2026-09-21T09:12:30.000Z' }
		});

		await sendAlert('pagerduty', config, alert({ kind: 'degraded', to: 'degraded' }));
		expect(call(fetch, 1).body.payload.severity).toBe('warning');

		await sendAlert('pagerduty', config, alert({ kind: 'up', from: 'down', to: 'up' }));
		({ body } = call(fetch, 2));
		expect(body).toEqual({ routing_key: 'R0UT1NG', event_action: 'resolve', dedup_key: 'bonk-monitor-7' });

		await sendAlert('pagerduty', config, alert({ kind: 'test' }));
		expect(call(fetch, 3).body).toMatchObject({ event_action: 'trigger', dedup_key: 'bonk-test' });
		expect(call(fetch, 4).body).toMatchObject({ event_action: 'resolve', dedup_key: 'bonk-test' });
	});

	it('throws on non-2xx', async () => {
		stubFetch(400, '{"status":"invalid event"}');
		await expect(sendAlert('pagerduty', { routingKey: 'x' }, alert())).rejects.toThrow(/HTTP 400/);
	});
});

describe('signing', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
	});

	it('dingtalk signs with HMAC-SHA256(secret, "ts\\nsecret")', async () => {
		expect(await dingtalkSign(1_700_000_000_000, 'SECtest123')).toBe('w3RMHXzixTMdzr8OHJUmVLS4IoPJVdu+Ut1LE48MePE=');
		const fetch = stubFetch(200, '{"errcode":0,"errmsg":"ok"}');
		await sendAlert(
			'dingtalk',
			{ webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=tok', secret: 'SECtest123' },
			alert()
		);
		const { url, body } = call(fetch);
		const u = new URL(url);
		expect(u.searchParams.get('access_token')).toBe('tok');
		expect(u.searchParams.get('timestamp')).toBe('1700000000000');
		expect(u.searchParams.get('sign')).toBe('w3RMHXzixTMdzr8OHJUmVLS4IoPJVdu+Ut1LE48MePE=');
		expect(url).toContain('sign=w3RMHXzixTMdzr8OHJUmVLS4IoPJVdu%2BUt1LE48MePE%3D');
		expect(body.msgtype).toBe('markdown');
		expect(body.markdown.title).toBe('Down · Sonor API');
	});

	it('dingtalk surfaces errcode on HTTP 200', async () => {
		stubFetch(200, '{"errcode":310000,"errmsg":"sign not match"}');
		await expect(
			sendAlert('dingtalk', { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=t' }, alert())
		).rejects.toThrow(/310000.*sign not match/);
	});

	it('feishu signs with key "ts\\nsecret" over an empty message', async () => {
		expect(await feishuSign(1_700_000_000, 'SECtest123')).toBe('eHRRCyLH7Z4IJQSJlfwertHZThRUYVu2hTUH02xPXYU=');
		const fetch = stubFetch(200, '{"code":0}');
		await sendAlert('feishu', { webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/x', secret: 'SECtest123' }, alert());
		expect(call(fetch).body).toMatchObject({
			timestamp: '1700000000',
			sign: 'eHRRCyLH7Z4IJQSJlfwertHZThRUYVu2hTUH02xPXYU=',
			msg_type: 'interactive'
		});
	});
});

describe('other providers smoke test', () => {
	it('every provider sends with plausible config', async () => {
		const fetch = stubFetch(200, '{}');
		const sample: Record<string, string> = {
			url: 'https://alert.victorops.com/integrations/generic/20131114/alert/k/r',
			webhookUrl: 'https://discord.com/api/webhooks/1/a',
			homeserver: 'https://matrix.example.org',
			roomId: '!room:example.org',
			site: 'https://x.zulipchat.com',
			server: 'https://push.example.com',
			baseUrl: 'https://ha.example.com',
			apiUrl: 'https://signal.example.com',
			service: 'mobile_app_pixel',
			accountSid: 'AC' + '0'.repeat(32),
			from: 'Bonk <alerts@example.com>',
			to: 'a@example.com, b@example.com',
			domain: 'mg.example.com',
			email: 'bot@x.zulipchat.com',
			stream: 'alerts',
			recipients: '+15550001, +15550002',
			number: '+15550000',
			chatId: '5',
			botToken: '1:abc',
			threadId: '42'
		};
		for (const p of providers) {
			const config: Record<string, string> = {};
			for (const f of p.fields) config[f.key] = sample[f.key] ?? 'value';
			if (p.id === 'twilio') config.to = '+15550001';
			if (p.id === 'webhook') config.headers = '{"x-a":"1"}';
			if (p.id === 'pushover' || p.id === 'bark' || p.id === 'gotify') delete config.priority;
			if (p.id === 'webhook') config.method = 'PUT';
			if (p.id === 'webhook') config.format = 'json';
			if (p.id === 'opsgenie' || p.id === 'mailgun') config.region = 'eu';
			await expect(p.send(config, alert()), p.id).resolves.toBeUndefined();
		}
		const urls = fetch.mock.calls.map(([u]) => String(u));
		expect(urls).toContain('https://api.eu.opsgenie.com/v2/alerts');
		expect(urls).toContain('https://api.eu.mailgun.net/v3/mg.example.com/messages');
		expect(urls.some((u) => /^https:\/\/matrix\.example\.org\/_matrix\/client\/v3\/rooms\/!room%3Aexample\.org\/send\/m\.room\.message\/bonk-[0-9a-f]{24}$/.test(u))).toBe(true);
	});
});
