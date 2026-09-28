import type { Provider } from '../types';
import { baseUrl, need, plainText, post, postForm, str, title, type PostInit } from '../format';

function parseHeaders(raw: string): Record<string, string> {
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('Custom headers must be a JSON object, e.g. {"Authorization": "Bearer …"}');
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Custom headers must be a JSON object');
	}
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(parsed)) out[k] = String(v);
	return out;
}

const provider: Provider = {
	id: 'webhook',
	name: 'Webhook',
	mono: 'WH',
	category: 'webhook',
	fields: [
		{ key: 'url', label: 'URL', type: 'url', required: true, secret: true, placeholder: 'https://example.com/hooks/bonk' },
		{
			key: 'method',
			label: 'Method',
			type: 'select',
			default: 'POST',
			options: [
				{ value: 'POST', label: 'POST' },
				{ value: 'PUT', label: 'PUT' }
			]
		},
		{
			key: 'format',
			label: 'Body',
			type: 'select',
			default: 'json',
			options: [
				{ value: 'json', label: 'JSON — the full alert plus title and text' },
				{ value: 'form', label: 'Form — title and text' }
			]
		},
		{
			key: 'headers',
			label: 'Custom headers',
			type: 'textarea',
			secret: true,
			placeholder: '{"Authorization": "Bearer …"}',
			help: 'JSON object. Stored encrypted since it usually carries credentials.'
		}
	],
	async send(config, alert) {
		const url = baseUrl(need(config, 'url', 'URL'), 'URL');
		const method = str(config, 'method').toUpperCase() === 'PUT' ? 'PUT' : 'POST';
		const init: PostInit = { method, headers: parseHeaders(str(config, 'headers')) };
		if (str(config, 'format') === 'form') {
			await postForm(url, { title: title(alert), text: plainText(alert) }, init);
		} else {
			await post(url, { ...alert, title: title(alert), text: plainText(alert) }, init);
		}
	}
};

export default provider;
