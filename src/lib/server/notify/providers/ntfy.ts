import type { Provider } from '../types';
import { baseUrl, basicAuth, lines, need, post, str, title, tone } from '../format';

const PRIORITY = { down: 5, degraded: 4, up: 3, test: 3 } as const;
const TAGS = { down: 'rotating_light', degraded: 'warning', up: 'white_check_mark', test: 'test_tube' } as const;

const provider: Provider = {
	id: 'ntfy',
	name: 'ntfy',
	mono: 'NT',
	category: 'push',
	docs: 'https://docs.ntfy.sh/publish/#publish-as-json',
	fields: [
		{ key: 'server', label: 'Server URL', type: 'url', default: 'https://ntfy.sh', placeholder: 'https://ntfy.sh' },
		{
			key: 'topic',
			label: 'Topic',
			type: 'password',
			required: true,
			secret: true,
			help: 'On ntfy.sh anyone who knows the topic can read it, so treat it like a password.'
		},
		{ key: 'token', label: 'Access token', type: 'password', secret: true, placeholder: 'tk_… (optional)' },
		{ key: 'username', label: 'Username', type: 'text', placeholder: 'Optional' },
		{ key: 'password', label: 'Password', type: 'password', secret: true, placeholder: 'Optional' }
	],
	async send(config, alert) {
		const server = baseUrl(str(config, 'server') || 'https://ntfy.sh', 'Server URL');
		const topic = need(config, 'topic', 'Topic');
		const headers: Record<string, string> = {};
		const token = str(config, 'token');
		const user = str(config, 'username');
		if (token) headers.authorization = `Bearer ${token}`;
		else if (user) headers.authorization = basicAuth(user, str(config, 'password'));

		const t = tone(alert);
		const body: Record<string, unknown> = {
			topic,
			title: title(alert),
			message: lines(alert, { link: false }).join('\n'),
			priority: PRIORITY[t],
			tags: [TAGS[t]]
		};
		if (alert.link) body.click = alert.link;
		await post(`${server}/`, body, { headers });
	}
};

export default provider;
