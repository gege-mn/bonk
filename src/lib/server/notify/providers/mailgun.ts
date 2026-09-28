import type { Provider } from '../types';
import { basicAuth, emailHtml, need, plainText, postForm, str, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'mailgun',
	name: 'Mailgun',
	mono: 'MG',
	category: 'email',
	docs: 'https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages',
	fields: [
		{ key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true },
		{ key: 'domain', label: 'Sending domain', type: 'text', required: true, placeholder: 'mg.example.com' },
		{
			key: 'region',
			label: 'Region',
			type: 'select',
			default: 'us',
			options: [
				{ value: 'us', label: 'US' },
				{ value: 'eu', label: 'EU' }
			]
		},
		fromField,
		toField
	],
	async send(config, alert) {
		const domain = need(config, 'domain', 'Sending domain');
		if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('Sending domain should look like mg.example.com');
		const host = str(config, 'region') === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
		const from = need(config, 'from', 'From');
		parseAddress(from);
		await postForm(
			`${host}/v3/${domain}/messages`,
			{ from, to: recipients(config), subject: title(alert), text: plainText(alert), html: emailHtml(alert) },
			{ headers: { authorization: basicAuth('api', need(config, 'apiKey', 'API key')) } }
		);
	}
};

export default provider;
