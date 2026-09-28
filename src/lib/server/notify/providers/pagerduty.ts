import type { Provider } from '../types';
import { iso, lines, need, post, severity, title, tone, truncate } from '../format';

const ENDPOINT = 'https://events.pagerduty.com/v2/enqueue';

const provider: Provider = {
	id: 'pagerduty',
	name: 'PagerDuty',
	mono: 'PD',
	category: 'incident',
	docs: 'https://developer.pagerduty.com/docs/events-api-v2/trigger-events/',
	fields: [
		{
			key: 'routingKey',
			label: 'Integration (routing) key',
			type: 'password',
			required: true,
			secret: true,
			help: 'Service → Integrations → Add "Events API V2" and copy the integration key.'
		}
	],
	async send(config, alert) {
		const routingKey = need(config, 'routingKey', 'Integration key');
		const t = tone(alert);
		const dedupKey = t === 'test' ? 'bonk-test' : `bonk-monitor-${alert.monitor.id}`;
		const trigger = {
			routing_key: routingKey,
			event_action: 'trigger',
			dedup_key: dedupKey,
			payload: {
				summary: truncate(`${title(alert)}: ${alert.reason}`, 1024),
				source: alert.monitor.target || alert.monitor.name,
				severity: severity(alert),
				timestamp: iso(alert.at),
				component: alert.monitor.name,
				group: alert.siteName || undefined,
				class: alert.kind,
				custom_details: { details: lines(alert, { link: false }), from: alert.from, to: alert.to }
			},
			client: 'Bonk',
			client_url: alert.link || undefined,
			links: alert.link ? [{ href: alert.link, text: 'Open monitor' }] : undefined
		};
		const resolve = { routing_key: routingKey, event_action: 'resolve', dedup_key: dedupKey };

		if (t === 'up') {
			await post(ENDPOINT, resolve);
		} else if (t === 'test') {
			// Open and immediately close so a test leaves no dangling incident behind.
			await post(ENDPOINT, trigger);
			await post(ENDPOINT, resolve);
		} else {
			await post(ENDPOINT, trigger);
		}
	}
};

export default provider;
