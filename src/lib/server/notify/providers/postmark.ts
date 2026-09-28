import type { Provider } from '../types';
import { emailHtml, need, plainText, post, str, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'postmark',
	name: 'Postmark',
	mono: 'PM',
	category: 'email',
	docs: 'https://postmarkapp.com/developer/api/email-api',
	fields: [
		{ key: 'serverToken', label: 'Server API token', type: 'password', required: true, secret: true },
		fromField,
		toField,
		{ key: 'stream', label: 'Message stream', type: 'text', default: 'outbound', placeholder: 'outbound' }
	],
	async send(config, alert) {
		const from = need(config, 'from', 'From');
		parseAddress(from);
		await post(
			'https://api.postmarkapp.com/email',
			{
				From: from,
				To: recipients(config).join(', '),
				Subject: title(alert),
				TextBody: plainText(alert),
				HtmlBody: emailHtml(alert),
				MessageStream: str(config, 'stream') || 'outbound'
			},
			{ headers: { 'x-postmark-server-token': need(config, 'serverToken', 'Server API token') } }
		);
	}
};

export default provider;
