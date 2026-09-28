import type { Provider } from '../types';
import { baseUrl, lines, need, post, title } from '../format';

const provider: Provider = {
	id: 'googlechat',
	name: 'Google Chat',
	mono: 'GC',
	category: 'chat',
	docs: 'https://developers.google.com/workspace/chat/quickstart/webhooks',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://chat.googleapis.com/v1/spaces/…/messages?key=…&token=…',
			help: 'Space → Apps & integrations → Webhooks → Add webhook.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		// Google Chat text only understands *bold*; escaping isn't supported, so strip the markers from user text.
		const clean = (s: string) => s.replace(/[*_~`]/g, '');
		const text = [`*${clean(title(alert))}*`, ...lines(alert, { link: false }).map((l) => (/^https?:/.test(l) ? l : clean(l)))];
		if (alert.link) text.push(`<${alert.link}|Open monitor>`);
		await post(url, { text: text.join('\n') });
	}
};

export default provider;
