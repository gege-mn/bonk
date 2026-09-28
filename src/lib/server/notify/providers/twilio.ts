import type { Provider } from '../types';
import { basicAuth, list, need, plainText, postForm, truncate } from '../format';

const provider: Provider = {
	id: 'twilio',
	name: 'Twilio SMS',
	mono: 'TW',
	category: 'push',
	docs: 'https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource',
	fields: [
		{ key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC…' },
		{ key: 'authToken', label: 'Auth token', type: 'password', required: true, secret: true },
		{
			key: 'from',
			label: 'From',
			type: 'text',
			required: true,
			placeholder: '+15551234567 or MG…',
			help: 'A Twilio phone number, or a Messaging Service SID (MG…).'
		},
		{ key: 'to', label: 'To', type: 'text', required: true, placeholder: '+15557654321', help: 'Comma-separated for several numbers.' }
	],
	async send(config, alert) {
		const sid = need(config, 'accountSid', 'Account SID');
		if (!/^AC[0-9a-f]{32}$/i.test(sid)) throw new Error('Account SID should start with AC');
		const from = need(config, 'from', 'From');
		const to = list(need(config, 'to', 'To'));
		const auth = basicAuth(sid, need(config, 'authToken', 'Auth token'));
		const body = truncate(plainText(alert), 1400);
		for (const number of to) {
			await postForm(
				`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
				{ To: number, Body: body, ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: from }) },
				{ headers: { authorization: auth } }
			);
		}
	}
};

export default provider;
