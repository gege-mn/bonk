import type { Provider } from '../types';
import { baseUrl, lines, need, post, title, tone } from '../format';

const TYPE = { down: 'CRITICAL', degraded: 'WARNING', up: 'RECOVERY', test: 'INFO' } as const;

const provider: Provider = {
	id: 'splunk',
	name: 'Splunk On-Call (VictorOps)',
	mono: 'SP',
	category: 'incident',
	docs: 'https://help.splunk.com/en/splunk-on-call/integrations/rest-endpoint-integration-guide',
	fields: [
		{
			key: 'url',
			label: 'REST endpoint URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://alert.victorops.com/integrations/generic/20131114/alert/<api-key>/<routing-key>',
			help: 'Integrations → REST Generic. Replace $routing_key at the end with your routing key.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'url', 'REST endpoint URL'), 'REST endpoint URL');
		if (url.includes('$routing_key')) throw new Error('Replace $routing_key in the URL with your routing key');
		const t = tone(alert);
		await post(url, {
			message_type: TYPE[t],
			entity_id: t === 'test' ? 'bonk-test' : `bonk-monitor-${alert.monitor.id}`,
			entity_display_name: title(alert),
			state_message: lines(alert).join('\n'),
			state_start_time: alert.at,
			monitoring_tool: 'Bonk'
		});
	}
};

export default provider;
