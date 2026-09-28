import type { Provider } from '../types';
import { baseUrl, lines, need, post, str, title, tone } from '../format';

const TYPE = { down: 'failure', degraded: 'warning', up: 'success', test: 'info' } as const;

const provider: Provider = {
	id: 'apprise',
	name: 'Apprise API',
	mono: 'AP',
	category: 'webhook',
	docs: 'https://github.com/caronc/apprise-api#persistent-configuration-storage',
	fields: [
		{
			key: 'url',
			label: 'Notify URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://apprise.example.com/notify/<key>',
			help: 'Your Apprise API server’s /notify/<config-key> endpoint. Fans out to anything Apprise supports.'
		},
		{ key: 'tags', label: 'Tags', type: 'text', placeholder: 'Optional, e.g. devops' }
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'url', 'Notify URL'), 'Notify URL');
		const body: Record<string, unknown> = {
			title: title(alert),
			body: lines(alert).join('\n'),
			type: TYPE[tone(alert)],
			format: 'text'
		};
		const tags = str(config, 'tags');
		if (tags) body.tag = tags;
		await post(url, body);
	}
};

export default provider;
