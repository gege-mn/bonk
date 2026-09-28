import type { Provider } from '../types';
import { baseUrl, colorInt, iso, markdownLines, need, post, str, title, tone, truncate } from '../format';

const provider: Provider = {
	id: 'discord',
	name: 'Discord',
	mono: 'DC',
	category: 'chat',
	docs: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://discord.com/api/webhooks/…',
			help: 'Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.'
		},
		{
			key: 'mention',
			label: 'Mention on down',
			type: 'text',
			placeholder: '@here or <@&roleId>',
			help: 'Posted with down alerts only, so recoveries stay quiet. Use <@&ROLE_ID> for a role, <@USER_ID> for a person.'
		},
		{ key: 'username', label: 'Bot name', type: 'text', placeholder: 'Bonk' },
		{ key: 'avatarUrl', label: 'Avatar URL', type: 'url', placeholder: 'https://…/avatar.png' },
		{
			key: 'threadId',
			label: 'Thread ID',
			type: 'text',
			placeholder: 'Optional',
			help: 'Post into an existing thread or forum post in the webhook’s channel.'
		}
	],
	async send(config, alert) {
		const url = new URL(baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL'));
		if (!/(^|\.)discord(app)?\.com$/.test(url.hostname) || !url.pathname.startsWith('/api/webhooks/')) {
			throw new Error('Webhook URL should look like https://discord.com/api/webhooks/…');
		}
		url.searchParams.set('wait', 'true');
		const threadId = str(config, 'threadId');
		if (threadId) url.searchParams.set('thread_id', threadId);

		const embed: Record<string, unknown> = {
			title: truncate(title(alert), 256),
			description: truncate(markdownLines(alert, { link: false }).join('\n'), 4096),
			color: colorInt(alert),
			timestamp: iso(alert.at)
		};
		if (alert.link) embed.url = alert.link;
		if (alert.siteName) embed.footer = { text: truncate(alert.siteName, 2048) };

		const body: Record<string, unknown> = { embeds: [embed] };
		const mention = str(config, 'mention');
		if (mention && tone(alert) === 'down') {
			body.content = truncate(mention, 2000);
			body.allowed_mentions = { parse: ['roles', 'users', 'everyone'] };
		} else {
			body.allowed_mentions = { parse: [] };
		}
		const username = str(config, 'username');
		if (username) body.username = truncate(username, 80);
		const avatar = str(config, 'avatarUrl');
		if (avatar) body.avatar_url = avatar;

		await post(url.toString(), body);
	}
};

export default provider;
