import type { Provider } from '../types';
import { baseUrl, lines, need, post, title, tone } from '../format';

const COLOR = { down: 'Attention', degraded: 'Warning', up: 'Good', test: 'Accent' } as const;

const provider: Provider = {
	id: 'teams',
	name: 'Microsoft Teams',
	mono: 'MT',
	category: 'chat',
	docs: 'https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Workflow webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://….logic.azure.com/workflows/… or https://….powerplatform.com/…',
			help: 'In the channel: ⋯ → Workflows → "Post to a channel when a webhook request is received", then copy the URL. Old Office 365 connector URLs are retired.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		const card: Record<string, unknown> = {
			$schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
			type: 'AdaptiveCard',
			version: '1.4',
			msteams: { width: 'Full' },
			body: [
				{
					type: 'TextBlock',
					text: title(alert),
					weight: 'Bolder',
					size: 'Medium',
					color: COLOR[tone(alert)],
					wrap: true
				},
				...lines(alert, { link: false }).map((text, i) => ({
					type: 'TextBlock',
					text,
					wrap: true,
					spacing: i === 0 ? 'Small' : 'None',
					isSubtle: i > 0
				}))
			]
		};
		if (alert.link) card.actions = [{ type: 'Action.OpenUrl', title: 'Open monitor', url: alert.link }];
		await post(url, {
			type: 'message',
			attachments: [
				{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }
			]
		});
	}
};

export default provider;
