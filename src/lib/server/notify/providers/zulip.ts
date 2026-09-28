import type { Provider } from '../types';
import { baseUrl, basicAuth, markdown, need, postForm, str } from '../format';

const provider: Provider = {
	id: 'zulip',
	name: 'Zulip',
	mono: 'ZU',
	category: 'chat',
	docs: 'https://zulip.com/api/send-message',
	fields: [
		{ key: 'site', label: 'Zulip URL', type: 'url', required: true, placeholder: 'https://yourorg.zulipchat.com' },
		{
			key: 'email',
			label: 'Bot email',
			type: 'text',
			required: true,
			placeholder: 'bonk-bot@yourorg.zulipchat.com',
			help: 'Personal settings → Bots → add an "Incoming webhook" or "Generic" bot.'
		},
		{ key: 'apiKey', label: 'Bot API key', type: 'password', required: true, secret: true },
		{ key: 'stream', label: 'Channel (stream)', type: 'text', required: true, placeholder: 'alerts' },
		{ key: 'topic', label: 'Topic', type: 'text', default: 'Bonk', placeholder: 'Bonk' }
	],
	async send(config, alert) {
		const site = baseUrl(need(config, 'site', 'Zulip URL'), 'Zulip URL');
		const email = need(config, 'email', 'Bot email');
		const key = need(config, 'apiKey', 'Bot API key');
		await postForm(
			`${site}/api/v1/messages`,
			{
				type: 'stream',
				to: need(config, 'stream', 'Channel'),
				topic: str(config, 'topic') || 'Bonk',
				content: markdown(alert)
			},
			{ headers: { authorization: basicAuth(email, key) } }
		);
	}
};

export default provider;
