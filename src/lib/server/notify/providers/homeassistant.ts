import type { Provider } from '../types';
import { baseUrl, lines, need, post, title } from '../format';

const provider: Provider = {
	id: 'homeassistant',
	name: 'Home Assistant',
	mono: 'HA',
	category: 'push',
	docs: 'https://developers.home-assistant.io/docs/api/rest/',
	fields: [
		{
			key: 'baseUrl',
			label: 'Home Assistant URL',
			type: 'url',
			required: true,
			placeholder: 'https://home.example.com',
			help: 'Must be reachable from the internet (e.g. Nabu Casa or a Cloudflare Tunnel).'
		},
		{
			key: 'token',
			label: 'Long-lived access token',
			type: 'password',
			required: true,
			secret: true,
			help: 'Profile → Security → Long-lived access tokens.'
		},
		{
			key: 'service',
			label: 'Notify service',
			type: 'text',
			required: true,
			placeholder: 'mobile_app_pixel_8',
			help: 'The part after "notify." in Developer tools → Actions.'
		}
	],
	async send(config, alert) {
		const base = baseUrl(need(config, 'baseUrl', 'Home Assistant URL'), 'Home Assistant URL');
		const service = need(config, 'service', 'Notify service').replace(/^notify\./, '');
		if (!/^[a-z0-9_]+$/.test(service)) throw new Error('Notify service should look like mobile_app_pixel_8');
		const body: Record<string, unknown> = { title: title(alert), message: lines(alert, { link: false }).join('\n') };
		if (alert.link) body.data = { url: alert.link, clickAction: alert.link };
		await post(`${base}/api/services/notify/${service}`, body, {
			headers: { authorization: `Bearer ${need(config, 'token', 'Access token')}` }
		});
	}
};

export default provider;
