import type { Provider } from '../types';
import { markdown, need, post } from '../format';

const provider: Provider = {
	id: 'webex',
	name: 'Webex',
	mono: 'WX',
	category: 'chat',
	docs: 'https://developer.webex.com/docs/api/v1/messages/create-a-message',
	fields: [
		{
			key: 'botToken',
			label: 'Bot access token',
			type: 'password',
			required: true,
			secret: true,
			help: 'Create a bot at developer.webex.com/my-apps and add it to the space.'
		},
		{ key: 'roomId', label: 'Space (room) ID', type: 'text', required: true }
	],
	async send(config, alert) {
		await post(
			'https://webexapis.com/v1/messages',
			{ roomId: need(config, 'roomId', 'Space ID'), markdown: markdown(alert).replace(/\n/g, '  \n') },
			{ headers: { authorization: `Bearer ${need(config, 'botToken', 'Bot access token')}` } }
		);
	}
};

export default provider;
