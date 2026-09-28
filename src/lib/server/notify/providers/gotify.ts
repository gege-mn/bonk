import type { Provider } from '../types';
import { baseUrl, markdownLines, need, post, str, title, tone } from '../format';

const DEFAULT = { down: 8, degraded: 5, up: 4, test: 4 } as const;

const provider: Provider = {
	id: 'gotify',
	name: 'Gotify',
	mono: 'GO',
	category: 'push',
	docs: 'https://gotify.net/docs/pushmsg',
	fields: [
		{ key: 'server', label: 'Server URL', type: 'url', required: true, placeholder: 'https://gotify.example.com' },
		{
			key: 'appToken',
			label: 'App token',
			type: 'password',
			required: true,
			secret: true,
			help: 'Apps → Create application, then copy its token.'
		},
		{
			key: 'priority',
			label: 'Priority',
			type: 'number',
			placeholder: 'Auto',
			help: '0–10. Leave empty for 8 on down, 5 on degraded, 4 on recovery.'
		}
	],
	async send(config, alert) {
		const server = baseUrl(need(config, 'server', 'Server URL'), 'Server URL');
		const token = need(config, 'appToken', 'App token');
		const p = str(config, 'priority');
		const priority = p === '' ? DEFAULT[tone(alert)] : Number(p);
		if (!Number.isInteger(priority)) throw new Error('Priority must be a whole number');
		const extras: Record<string, unknown> = { 'client::display': { contentType: 'text/markdown' } };
		if (alert.link) extras['client::notification'] = { click: { url: alert.link } };
		await post(
			`${server}/message`,
			{ title: title(alert), message: markdownLines(alert).join('  \n'), priority, extras },
			{ headers: { 'x-gotify-key': token } }
		);
	}
};

export default provider;
