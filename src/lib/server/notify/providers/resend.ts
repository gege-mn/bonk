import type { Provider } from '../types';
import { emailHtml, need, plainText, post, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'resend',
	name: 'Resend',
	mono: 'RS',
	category: 'email',
	docs: 'https://resend.com/docs/api-reference/emails/send-email',
	fields: [
		{ key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true, placeholder: 're_…' },
		fromField,
		toField
	],
	async send(config, alert) {
		const from = need(config, 'from', 'From');
		parseAddress(from);
		await post(
			'https://api.resend.com/emails',
			{ from, to: recipients(config), subject: title(alert), text: plainText(alert), html: emailHtml(alert) },
			{ headers: { authorization: `Bearer ${need(config, 'apiKey', 'API key')}` } }
		);
	}
};

export default provider;
