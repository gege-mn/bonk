import type { Provider } from '../types';
import { need, plainText, post, truncate } from '../format';

const provider: Provider = {
	id: 'line',
	name: 'LINE',
	mono: 'LN',
	category: 'chat',
	docs: 'https://developers.line.biz/en/reference/messaging-api/#send-push-message',
	fields: [
		{
			key: 'channelToken',
			label: 'Channel access token',
			type: 'password',
			required: true,
			secret: true,
			help: 'LINE Developers console → your Messaging API channel → Messaging API → Channel access token (long-lived).'
		},
		{
			key: 'to',
			label: 'User, group or room ID',
			type: 'text',
			required: true,
			placeholder: 'U4af4980629…',
			help: 'Not the LINE ID you search for — the internal ID (U…, C…, R…) delivered in webhook events. Your own user ID is on the channel’s Basic settings tab.'
		}
	],
	async send(config, alert) {
		await post(
			'https://api.line.me/v2/bot/message/push',
			{ to: need(config, 'to', 'Recipient ID'), messages: [{ type: 'text', text: truncate(plainText(alert), 5000) }] },
			{ headers: { authorization: `Bearer ${need(config, 'channelToken', 'Channel access token')}` } }
		);
	}
};

export default provider;
