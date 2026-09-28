import type { Provider } from '../types';
import { baseUrl, color, escapeMarkdown, markdownLines, need, post, str, title } from '../format';

const provider: Provider = {
	id: 'mattermost',
	name: 'Mattermost',
	mono: 'MM',
	category: 'chat',
	docs: 'https://developers.mattermost.com/integrate/webhooks/incoming/',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://mattermost.example.com/hooks/…'
		},
		{ key: 'channel', label: 'Channel override', type: 'text', placeholder: 'town-square' },
		{ key: 'username', label: 'Username override', type: 'text', placeholder: 'Bonk' },
		{ key: 'iconUrl', label: 'Icon URL', type: 'url' }
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		const body: Record<string, unknown> = {
			attachments: [
				{
					fallback: title(alert),
					color: color(alert),
					title: escapeMarkdown(title(alert)),
					title_link: alert.link || undefined,
					text: markdownLines(alert, { link: false }).join('\n')
				}
			]
		};
		const channel = str(config, 'channel');
		if (channel) body.channel = channel;
		const username = str(config, 'username');
		if (username) body.username = username;
		const icon = str(config, 'iconUrl');
		if (icon) body.icon_url = icon;
		await post(url, body);
	}
};

export default provider;
