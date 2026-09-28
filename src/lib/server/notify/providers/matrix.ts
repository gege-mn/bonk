import type { Provider } from '../types';
import { baseUrl, html, need, plainText, post, randomId } from '../format';

const provider: Provider = {
	id: 'matrix',
	name: 'Matrix',
	mono: 'MX',
	category: 'chat',
	docs: 'https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid',
	fields: [
		{
			key: 'homeserver',
			label: 'Homeserver URL',
			type: 'url',
			required: true,
			default: 'https://matrix-client.matrix.org',
			placeholder: 'https://matrix.example.org'
		},
		{
			key: 'accessToken',
			label: 'Access token',
			type: 'password',
			required: true,
			secret: true,
			help: 'Access token of a bot account that has joined the room (Element: Settings → Help & About → Access token).'
		},
		{
			key: 'roomId',
			label: 'Room ID',
			type: 'text',
			required: true,
			placeholder: '!abcdefg:example.org',
			help: 'Room settings → Advanced → Internal room ID.'
		}
	],
	async send(config, alert) {
		const hs = baseUrl(need(config, 'homeserver', 'Homeserver URL'), 'Homeserver URL');
		const token = need(config, 'accessToken', 'Access token');
		const room = need(config, 'roomId', 'Room ID');
		if (!room.startsWith('!')) throw new Error('Room ID must be the internal ID starting with "!", not an alias');
		await post(
			`${hs}/_matrix/client/v3/rooms/${encodeURIComponent(room)}/send/m.room.message/bonk-${randomId()}`,
			{
				msgtype: 'm.text',
				body: plainText(alert),
				format: 'org.matrix.custom.html',
				formatted_body: html(alert, { separator: '<br>' })
			},
			{ method: 'PUT', headers: { authorization: `Bearer ${token}` } }
		);
	}
};

export default provider;
