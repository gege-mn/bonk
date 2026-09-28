import type { Provider } from '../types';
import { base64, baseUrl, escapeMarkdown, expectCode, hmacSha256, markdownLines, need, post, str, title } from '../format';

export async function dingtalkSign(timestamp: number, secret: string): Promise<string> {
	return base64(await hmacSha256(secret, `${timestamp}\n${secret}`));
}

const provider: Provider = {
	id: 'dingtalk',
	name: 'DingTalk',
	mono: 'DT',
	category: 'chat',
	docs: 'https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=…'
		},
		{
			key: 'secret',
			label: 'Signing secret',
			type: 'password',
			secret: true,
			placeholder: 'SEC…',
			help: 'Recommended security mode. With keyword mode instead, use a word every alert contains, such as "UTC".'
		}
	],
	async send(config, alert) {
		const url = new URL(baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL'));
		const secret = str(config, 'secret');
		if (secret) {
			const timestamp = Date.now();
			url.searchParams.set('timestamp', String(timestamp));
			url.searchParams.set('sign', await dingtalkSign(timestamp, secret));
		}
		const body = [`#### ${escapeMarkdown(title(alert))}`, ...markdownLines(alert, { link: false })];
		if (alert.link) body.push(`[Open monitor](${alert.link})`);
		const res = await post(url.toString(), {
			msgtype: 'markdown',
			markdown: { title: title(alert), text: body.join('\n\n') }
		});
		await expectCode(res, 'errcode');
	}
};

export default provider;
