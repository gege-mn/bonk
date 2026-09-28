import type { Provider } from '../types';
import { lines, need, post, str, title } from '../format';

const provider: Provider = {
	id: 'pushbullet',
	name: 'Pushbullet',
	mono: 'PB',
	category: 'push',
	docs: 'https://docs.pushbullet.com/#create-push',
	fields: [
		{
			key: 'accessToken',
			label: 'Access token',
			type: 'password',
			required: true,
			secret: true,
			help: 'pushbullet.com → Settings → Account → Create Access Token.'
		},
		{ key: 'channelTag', label: 'Channel tag', type: 'text', placeholder: 'Optional; pushes to your devices if empty' }
	],
	async send(config, alert) {
		const body: Record<string, unknown> = alert.link
			? { type: 'link', url: alert.link, title: title(alert), body: lines(alert, { link: false }).join('\n') }
			: { type: 'note', title: title(alert), body: lines(alert).join('\n') };
		const channel = str(config, 'channelTag');
		if (channel) body.channel_tag = channel;
		await post('https://api.pushbullet.com/v2/pushes', body, {
			headers: { 'access-token': need(config, 'accessToken', 'Access token') }
		});
	}
};

export default provider;
