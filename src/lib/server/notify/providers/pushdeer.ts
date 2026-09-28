import type { Provider } from '../types';
import { baseUrl, lines, need, postForm, str, title } from '../format';

const provider: Provider = {
	id: 'pushdeer',
	name: 'PushDeer',
	mono: 'DE',
	category: 'push',
	docs: 'https://github.com/easychen/pushdeer',
	fields: [
		{ key: 'server', label: 'Server URL', type: 'url', default: 'https://api2.pushdeer.com', placeholder: 'https://api2.pushdeer.com' },
		{ key: 'pushKey', label: 'Push key', type: 'password', required: true, secret: true, placeholder: 'PDU…' }
	],
	async send(config, alert) {
		const server = baseUrl(str(config, 'server') || 'https://api2.pushdeer.com', 'Server URL');
		const res = await postForm(`${server}/message/push`, {
			pushkey: need(config, 'pushKey', 'Push key'),
			text: title(alert),
			desp: lines(alert).join('\n\n'),
			type: 'markdown'
		});
		const data = (await res.json().catch(() => null)) as { code?: number; error?: string } | null;
		if (data && data.code !== undefined && data.code !== 0) throw new Error(`Error ${data.code}${data.error ? `: ${data.error}` : ''}`);
	}
};

export default provider;
