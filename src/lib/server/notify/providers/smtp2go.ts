import type { Provider } from '../types';
import { emailHtml, need, plainText, post, title } from '../format';
import { fromField, parseAddress, recipients, toField } from '../email';

const provider: Provider = {
	id: 'smtp2go',
	name: 'SMTP2GO',
	mono: 'S2',
	category: 'email',
	docs: 'https://developers.smtp2go.com/reference/send-standard-email',
	fields: [
		{ key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true, placeholder: 'api-…' },
		fromField,
		toField
	],
	async send(config, alert) {
		const sender = need(config, 'from', 'From');
		parseAddress(sender);
		const res = await post(
			'https://api.smtp2go.com/v3/email/send',
			{ sender, to: recipients(config), subject: title(alert), text_body: plainText(alert), html_body: emailHtml(alert) },
			{ headers: { 'x-smtp2go-api-key': need(config, 'apiKey', 'API key') } }
		);
		const data = (await res.json().catch(() => null)) as { data?: { failed?: number; failures?: string[] } } | null;
		if (data?.data?.failed) throw new Error(`Rejected: ${(data.data.failures ?? []).join('; ').slice(0, 200)}`);
	}
};

export default provider;
