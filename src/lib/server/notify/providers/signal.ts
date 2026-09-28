import type { Provider } from '../types';
import { baseUrl, list, need, plainText, post } from '../format';

const provider: Provider = {
	id: 'signal',
	name: 'Signal',
	mono: 'SI',
	category: 'chat',
	docs: 'https://github.com/bbernhard/signal-cli-rest-api',
	fields: [
		{
			key: 'apiUrl',
			label: 'signal-cli-rest-api URL',
			type: 'url',
			required: true,
			placeholder: 'https://signal-api.example.com',
			help: 'Signal has no public API; this needs your own signal-cli-rest-api reachable from Cloudflare (e.g. behind a Tunnel).'
		},
		{ key: 'number', label: 'Sender number', type: 'text', required: true, placeholder: '+15551234567' },
		{
			key: 'recipients',
			label: 'Recipients',
			type: 'text',
			required: true,
			placeholder: '+15557654321, group.abc…',
			help: 'Comma-separated phone numbers or group IDs.'
		}
	],
	async send(config, alert) {
		const api = baseUrl(need(config, 'apiUrl', 'API URL'), 'API URL');
		const recipients = list(need(config, 'recipients', 'Recipients'));
		if (!recipients.length) throw new Error('Recipients is required');
		await post(`${api}/v2/send`, {
			message: plainText(alert),
			number: need(config, 'number', 'Sender number'),
			recipients
		});
	}
};

export default provider;
