import type { Provider } from '../types';
import { baseUrl, lines, need, post, str, title, tone } from '../format';

const provider: Provider = {
	id: 'bark',
	name: 'Bark',
	mono: 'BK',
	category: 'push',
	docs: 'https://bark.day.app/#/tutorial',
	fields: [
		{ key: 'server', label: 'Server URL', type: 'url', default: 'https://api.day.app', placeholder: 'https://api.day.app' },
		{
			key: 'deviceKey',
			label: 'Device key',
			type: 'password',
			required: true,
			secret: true,
			help: 'The key shown in the Bark app (the part after the server in the example URL).'
		},
		{ key: 'group', label: 'Group', type: 'text', default: 'Bonk', placeholder: 'Bonk' },
		{ key: 'sound', label: 'Sound', type: 'text', placeholder: 'Default' }
	],
	async send(config, alert) {
		const server = baseUrl(str(config, 'server') || 'https://api.day.app', 'Server URL');
		const t = tone(alert);
		const body: Record<string, unknown> = {
			device_key: need(config, 'deviceKey', 'Device key'),
			title: title(alert),
			body: lines(alert, { link: false }).join('\n'),
			group: str(config, 'group') || 'Bonk',
			level: t === 'down' ? 'timeSensitive' : t === 'degraded' ? 'active' : 'passive'
		};
		if (t === 'test') body.level = 'active';
		if (alert.link) body.url = alert.link;
		const sound = str(config, 'sound');
		if (sound) body.sound = sound;
		await post(`${server}/push`, body);
	}
};

export default provider;
