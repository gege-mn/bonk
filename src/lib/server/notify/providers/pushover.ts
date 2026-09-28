import type { Provider } from '../types';
import { lines, need, post, str, title, tone, truncate } from '../format';

const provider: Provider = {
	id: 'pushover',
	name: 'Pushover',
	mono: 'PO',
	category: 'push',
	docs: 'https://pushover.net/api',
	fields: [
		{ key: 'userKey', label: 'User or group key', type: 'password', required: true, secret: true },
		{
			key: 'appToken',
			label: 'Application token',
			type: 'password',
			required: true,
			secret: true,
			help: 'Create an application at pushover.net/apps/build.'
		},
		{ key: 'device', label: 'Device', type: 'text', placeholder: 'All devices' },
		{
			key: 'priority',
			label: 'Priority',
			type: 'select',
			default: 'auto',
			options: [
				{ value: 'auto', label: 'Auto (high when down)' },
				{ value: '-1', label: 'Low' },
				{ value: '0', label: 'Normal' },
				{ value: '1', label: 'High' },
				{ value: '2', label: 'Emergency when down (repeats until acknowledged)' }
			]
		},
		{ key: 'sound', label: 'Sound', type: 'text', placeholder: 'Default' }
	],
	async send(config, alert) {
		const down = tone(alert) === 'down';
		const choice = str(config, 'priority') || 'auto';
		let priority = choice === 'auto' ? (down ? 1 : 0) : Number(choice);
		if (priority === 2 && !down) priority = 1;
		const body: Record<string, unknown> = {
			token: need(config, 'appToken', 'Application token'),
			user: need(config, 'userKey', 'User key'),
			title: truncate(title(alert), 250),
			message: truncate(lines(alert, { link: false }).join('\n'), 1024),
			priority,
			timestamp: alert.at
		};
		if (priority === 2) Object.assign(body, { retry: 60, expire: 3600 });
		const device = str(config, 'device');
		if (device) body.device = device;
		const sound = str(config, 'sound');
		if (sound) body.sound = sound;
		if (alert.link) Object.assign(body, { url: alert.link, url_title: 'Open monitor' });
		await post('https://api.pushover.net/1/messages.json', body);
	}
};

export default provider;
