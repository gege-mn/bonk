import type { Alert, Provider } from '../types';
import { baseUrl, color, lines, need, post, title } from '../format';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mrkdwn(alert: Alert): string {
	const body = lines(alert, { link: false }).map(esc);
	if (alert.link) body.push(`<${alert.link}|Open monitor>`);
	return [`*${esc(title(alert))}*`, ...body].join('\n');
}

const provider: Provider = {
	id: 'slack',
	name: 'Slack',
	mono: 'SL',
	category: 'chat',
	docs: 'https://api.slack.com/messaging/webhooks',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://hooks.slack.com/services/…',
			help: 'Create a Slack app, enable Incoming Webhooks and add one for your channel.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		await post(url, {
			text: title(alert),
			attachments: [
				{
					color: color(alert),
					blocks: [{ type: 'section', text: { type: 'mrkdwn', text: mrkdwn(alert) } }]
				}
			]
		});
	}
};

export default provider;
