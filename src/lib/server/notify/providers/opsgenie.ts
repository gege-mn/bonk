import type { Provider } from '../types';
import { lines, need, plainText, post, str, title, tone, truncate } from '../format';

const PRIORITY = { down: 'P1', degraded: 'P3', up: 'P5', test: 'P5' } as const;

const provider: Provider = {
	id: 'opsgenie',
	name: 'Opsgenie',
	mono: 'OG',
	category: 'incident',
	docs: 'https://docs.opsgenie.com/docs/alert-api',
	fields: [
		{
			key: 'apiKey',
			label: 'API key',
			type: 'password',
			required: true,
			secret: true,
			help: 'Team → Integrations → add an "API" integration and copy its key.'
		},
		{
			key: 'region',
			label: 'Region',
			type: 'select',
			default: 'us',
			options: [
				{ value: 'us', label: 'US (api.opsgenie.com)' },
				{ value: 'eu', label: 'EU (api.eu.opsgenie.com)' }
			]
		},
		{ key: 'responders', label: 'Team name', type: 'text', placeholder: 'Optional responder team' }
	],
	async send(config, alert) {
		const key = need(config, 'apiKey', 'API key');
		const base = str(config, 'region') === 'eu' ? 'https://api.eu.opsgenie.com' : 'https://api.opsgenie.com';
		const headers = { authorization: `GenieKey ${key}` };
		const t = tone(alert);
		const alias = t === 'test' ? 'bonk-test' : `bonk-monitor-${alert.monitor.id}`;

		if (t === 'up') {
			await post(
				`${base}/v2/alerts/${encodeURIComponent(alias)}/close?identifierType=alias`,
				{ source: 'Bonk', note: lines(alert).join('\n') },
				{ headers }
			);
			return;
		}
		const body: Record<string, unknown> = {
			message: truncate(title(alert), 130),
			alias,
			description: truncate(plainText(alert), 15000),
			priority: PRIORITY[t],
			source: 'Bonk',
			entity: truncate(alert.monitor.name, 512),
			tags: ['bonk', t],
			details: { target: alert.monitor.target, reason: alert.reason, ...(alert.link ? { link: alert.link } : {}) }
		};
		const team = str(config, 'responders');
		if (team) body.responders = [{ type: 'team', name: team }];
		await post(`${base}/v2/alerts`, body, { headers });
	}
};

export default provider;
