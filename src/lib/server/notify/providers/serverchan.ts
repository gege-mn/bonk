import type { Provider } from '../types';
import { expectCode, lines, need, postForm, title } from '../format';

/** SendKeys from Server酱³ ("sctp{uid}t…") use a per-user host; Turbo keys use sctapi. */
export function serverchanUrl(key: string): string {
	const m = /^sctp(\d+)t/i.exec(key);
	return m
		? `https://${m[1]}.push.ft07.com/send/${encodeURIComponent(key)}.send`
		: `https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`;
}

const provider: Provider = {
	id: 'serverchan',
	name: 'ServerChan (Server酱)',
	mono: 'SC',
	category: 'push',
	docs: 'https://sct.ftqq.com/',
	fields: [{ key: 'sendKey', label: 'SendKey', type: 'password', required: true, secret: true, placeholder: 'SCT… or sctp…' }],
	async send(config, alert) {
		const res = await postForm(serverchanUrl(need(config, 'sendKey', 'SendKey')), {
			title: title(alert),
			desp: lines(alert).join('\n\n')
		});
		await expectCode(res, 'code');
	}
};

export default provider;
