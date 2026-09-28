import type { Provider } from '../types';
import { base64, baseUrl, expectCode, hmacSha256, lines, need, post, str, title, tone } from '../format';

const TEMPLATE = { down: 'red', degraded: 'orange', up: 'green', test: 'purple' } as const;

/** Feishu's scheme: the HMAC key is "timestamp\nsecret" and the message is empty. */
export async function feishuSign(timestamp: number, secret: string): Promise<string> {
	return base64(await hmacSha256(`${timestamp}\n${secret}`, ''));
}

const provider: Provider = {
	id: 'feishu',
	name: 'Feishu / Lark',
	mono: 'FS',
	category: 'chat',
	docs: 'https://open.larksuite.com/document/client-docs/bot-v3/add-custom-bot',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/… or https://open.larksuite.com/…',
			help: 'Group settings → Bots → Add bot → Custom bot.'
		},
		{
			key: 'secret',
			label: 'Signing secret',
			type: 'password',
			secret: true,
			help: 'Only if "Signature verification" is enabled in the bot’s security settings.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		const body: Record<string, unknown> = {
			msg_type: 'interactive',
			card: {
				header: { title: { tag: 'plain_text', content: title(alert) }, template: TEMPLATE[tone(alert)] },
				elements: [
					{ tag: 'div', text: { tag: 'plain_text', content: lines(alert, { link: false }).join('\n') } },
					...(alert.link
						? [
								{
									tag: 'action',
									actions: [
										{
											tag: 'button',
											text: { tag: 'plain_text', content: 'Open monitor' },
											type: 'default',
											url: alert.link
										}
									]
								}
							]
						: [])
				]
			}
		};
		const secret = str(config, 'secret');
		if (secret) {
			const timestamp = Math.floor(Date.now() / 1000);
			body.timestamp = String(timestamp);
			body.sign = await feishuSign(timestamp, secret);
		}
		await expectCode(await post(url, body), 'code');
	}
};

export default provider;
