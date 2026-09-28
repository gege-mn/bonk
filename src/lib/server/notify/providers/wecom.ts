import type { Provider } from '../types';
import { baseUrl, expectCode, lines, need, post, title, tone } from '../format';

const FONT = { down: 'warning', degraded: 'comment', up: 'info', test: 'comment' } as const;

const provider: Provider = {
	id: 'wecom',
	name: 'WeCom (WeChat Work)',
	mono: 'WC',
	category: 'chat',
	docs: 'https://developer.work.weixin.qq.com/document/path/91770',
	fields: [
		{
			key: 'webhookUrl',
			label: 'Webhook URL',
			type: 'url',
			required: true,
			secret: true,
			placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'webhookUrl', 'Webhook URL'), 'Webhook URL');
		const strip = (s: string) => s.replace(/[<>*`[\]]/g, '');
		const body = [`**<font color="${FONT[tone(alert)]}">${strip(title(alert))}</font>**`];
		for (const l of lines(alert, { link: false })) body.push(`> ${strip(l)}`);
		if (alert.link) body.push(`[Open monitor](${alert.link})`);
		const res = await post(url, { msgtype: 'markdown', markdown: { content: body.join('\n') } });
		await expectCode(res, 'errcode');
	}
};

export default provider;
