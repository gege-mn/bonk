import type { Provider } from '../types';
import { bool, html, need, post, str } from '../format';

const provider: Provider = {
	id: 'telegram',
	name: 'Telegram',
	mono: 'TG',
	category: 'chat',
	docs: 'https://core.telegram.org/bots/tutorial#obtain-your-bot-token',
	fields: [
		{
			key: 'botToken',
			label: 'Bot token',
			type: 'password',
			required: true,
			secret: true,
			placeholder: '123456789:AAF…',
			help: 'Create a bot with @BotFather and paste the token it gives you.'
		},
		{
			key: 'chatId',
			label: 'Chat ID',
			type: 'text',
			required: true,
			placeholder: '-1001234567890',
			help: 'Send any message to your bot (or add it to the group), then open https://api.telegram.org/bot<token>/getUpdates and copy "chat":{"id":…}. Group and channel IDs start with -100. For a public channel, @channelname also works.'
		},
		{
			key: 'threadId',
			label: 'Topic (thread) ID',
			type: 'text',
			placeholder: 'Optional',
			help: 'For forum groups: the message_thread_id of the topic to post in.'
		},
		{
			key: 'silent',
			label: 'Send silently',
			type: 'checkbox',
			default: false,
			help: 'Deliver without sound.'
		}
	],
	async send(config, alert) {
		const token = need(config, 'botToken', 'Bot token');
		const chatId = need(config, 'chatId', 'Chat ID');
		const threadId = str(config, 'threadId');
		if (threadId && !/^\d+$/.test(threadId)) throw new Error('Topic ID must be a number');
		if (!/^\d+:[\w-]+$/.test(token)) throw new Error('Bot token looks wrong (expected 123456:ABC…)');

		const body: Record<string, unknown> = {
			chat_id: chatId,
			text: html(alert, { linkText: 'Open monitor' }),
			parse_mode: 'HTML',
			link_preview_options: { is_disabled: true },
			disable_notification: bool(config, 'silent')
		};
		if (threadId) body.message_thread_id = Number(threadId);
		await post(`https://api.telegram.org/bot${token}/sendMessage`, body);
	}
};

export default provider;
