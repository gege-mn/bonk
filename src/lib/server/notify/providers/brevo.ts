import type { Provider } from '../types';
import { emailHtml, need, plainText, post, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'brevo',
	name: 'Brevo',
	mono: 'BR',
	category: 'email',
	docs: 'https://developers.brevo.com/reference/sendtransacemail',
	fields: [
		{ key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true, placeholder: 'xkeysib-…' },
		fromField,
		toField
	],
	async send(config, alert) {
		await post(
			'https://api.brevo.com/v3/smtp/email',
			{
				sender: parseAddress(need(config, 'from', 'From')),
				to: recipients(config).map(parseAddress),
				subject: title(alert),
				textContent: plainText(alert),
				htmlContent: emailHtml(alert)
			},
			{ headers: { 'api-key': need(config, 'apiKey', 'API key') } }
		);
	}
};

export default provider;
