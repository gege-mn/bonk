import type { Provider } from '../types';
import { emailHtml, need, plainText, post, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'sendgrid',
	name: 'SendGrid',
	mono: 'SG',
	category: 'email',
	docs: 'https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send',
	fields: [
		{ key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true, placeholder: 'SG.…' },
		fromField,
		toField
	],
	async send(config, alert) {
		await post(
			'https://api.sendgrid.com/v3/mail/send',
			{
				personalizations: [{ to: recipients(config).map(parseAddress) }],
				from: parseAddress(need(config, 'from', 'From')),
				subject: title(alert),
				content: [
					{ type: 'text/plain', value: plainText(alert) },
					{ type: 'text/html', value: emailHtml(alert) }
				]
			},
			{ headers: { authorization: `Bearer ${need(config, 'apiKey', 'API key')}` } }
		);
	}
};

export default provider;
