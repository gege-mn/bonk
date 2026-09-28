import type { Provider } from '../types';
import { baseUrl, color, lines, need, post, str, title } from '../format';

const provider: Provider = {
	id: 'rocketchat',
	name: 'Rocket.Chat',
	mono: 'RC',
	category: 'chat',
	docs: 'https://docs.rocket.chat/docs/integrations',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://chat.example.com/hooks/…',
			help: 'Administration → Integrations → New → Incoming.'
		},
		{ key: 'channel', label: 'Channel override', type: 'text', placeholder: '#alerts' }
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		const body: Record<string, unknown> = {
			text: title(alert),
			attachments: [
				{
					title: title(alert),
					title_link: alert.link || undefined,
					text: lines(alert, { link: false }).join('\n'),
					color: color(alert)
				}
			]
		};
		const channel = str(config, 'channel');
		if (channel) body.channel = channel;
		await post(url, body);
	}
};

export default provider;
