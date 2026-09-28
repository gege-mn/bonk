<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { fmtMs } from '$lib/format';

	type Values = Record<string, unknown>;
	type Test = {
		result: string;
		latency: number | null;
		message: string;
		ranAt: number;
		detail?: { status?: number; statusText?: string; headers?: Record<string, string>; body?: string };
	};

	let {
		monitor = null,
		selected = null,
		channels,
		groups,
		pushUrl = null,
		form,
		cancelHref
	}: {
		monitor?: object | null;
		selected?: number[] | null;
		channels: { id: number; name: string; provider: string; default_on: number }[];
		groups: string[];
		pushUrl?: string | null;
		form: { values?: Values; errors?: Record<string, string>; channelIds?: number[]; test?: Test | null; testError?: string | null } | null;
		cancelHref: string;
	} = $props();

	const TYPES = [
		{ id: 'http', name: 'HTTP(s)', hint: 'status + speed' },
		{ id: 'keyword', name: 'Keyword', hint: 'text in body' },
		{ id: 'json', name: 'JSON', hint: 'value at a path' },
		{ id: 'tcp', name: 'TCP port', hint: 'host:port open' },
		{ id: 'dns', name: 'DNS', hint: 'record matches' },
		{ id: 'push', name: 'Push', hint: 'expects a ping' }
	];
	const INTERVALS = [
		[60, '1 minute'],
		[120, '2 minutes'],
		[300, '5 minutes'],
		[600, '10 minutes'],
		[900, '15 minutes'],
		[1800, '30 minutes'],
		[3600, '1 hour']
	] as const;
	const PUSH_INTERVALS = [
		[300, '5 minutes'],
		[900, '15 minutes'],
		[3600, '1 hour'],
		[21600, '6 hours'],
		[43200, '12 hours'],
		[86400, '1 day'],
		[604800, '1 week']
	] as const;

	const DEFAULTS: Values = {
		name: '',
		type: 'http',
		target: '',
		method: 'GET',
		headers: '{}',
		body: '',
		expected_status: '2xx',
		follow_redirects: 1,
		keyword: '',
		keyword_invert: 0,
		json_path: '',
		json_expected: '',
		dns_type: 'A',
		dns_expected: '',
		interval_s: 60,
		timeout_ms: 10000,
		slow_ms: null,
		alert_after: 3,
		resend_min: 0,
		paused: 0,
		public: 1,
		public_name: '',
		group_name: '',
		sort: 0
	};

	function initial(): Values {
		return untrack(() => ({ ...DEFAULTS, ...((monitor ?? {}) as Values), ...(form?.values ?? {}) }));
	}
	const v = initial();
	let type = $state(String(v.type));
	const s = (k: string) => (v[k] === null || v[k] === undefined ? '' : String(v[k]));
	const on = (k: string) => Boolean(Number(v[k]));

	const chosen = untrack(() => new Set(form?.channelIds ?? selected ?? channels.filter((c) => c.default_on).map((c) => c.id)));
	const err = $derived(form?.errors ?? {});
	const isHttp = $derived(type === 'http' || type === 'keyword' || type === 'json');
	let busy = $state<string | null>(null);
	const hasAdvanced = !!(v.headers && v.headers !== '{}') || !!v.body || v.method !== 'GET' || !Number(v.follow_redirects);
</script>

<div class="layout">
	<form
		method="POST"
		action="?/save"
		class="form"
		use:enhance={({ submitter }) => {
			busy = submitter?.getAttribute('formaction') === '?/test' ? 'test' : 'save';
			return async ({ update }) => {
				await update({ reset: false });
				busy = null;
			};
		}}
	>
		<fieldset>
			<legend class="legend">What to check</legend>
			<div class="segmented types">
				{#each TYPES as t (t.id)}
					<label>
						<input type="radio" name="type" value={t.id} bind:group={type} />
						<span class="seg-title">{t.name}</span>
						<span class="seg-hint">{t.hint}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="grid2">
			<label class="field">
				Name
				<input class="input" name="name" value={s('name')} required maxlength="80" placeholder="e.g. Sonor API" aria-invalid={err.name ? 'true' : undefined} />
				{#if err.name}<span class="error">{err.name}</span>{/if}
			</label>
			{#if isHttp}
				<label class="field">
					Method
					<select class="select" name="method" value={s('method')}>
						{#each ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as m (m)}<option>{m}</option>{/each}
					</select>
				</label>
			{:else if type === 'dns'}
				<label class="field">
					Record type
					<select class="select" name="dns_type" value={s('dns_type')}>
						{#each ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'] as t (t)}<option>{t}</option>{/each}
					</select>
				</label>
			{:else}
				<span></span>
			{/if}
			{#if type !== 'push'}
				<label class="field wide">
					{isHttp ? 'URL' : type === 'tcp' ? 'Host and port' : 'Hostname'}
					<input
						class="input"
						name="target"
						value={s('target')}
						required
						placeholder={isHttp ? 'https://example.com/health' : type === 'tcp' ? 'example.com:22' : 'example.com'}
						aria-invalid={err.target ? 'true' : undefined}
					/>
					{#if err.target}<span class="error">{err.target}</span>{/if}
					{#if type === 'tcp'}<span class="help">Cloudflare blocks TCP connections to its own IP ranges, so use this for origins that aren't proxied through Cloudflare.</span>{/if}
				</label>
			{:else}
				<div class="notice wide">
					{#if pushUrl}
						<span>Have your job request this URL each time it runs (GET or POST): <code class="push">{pushUrl}</code></span>
					{:else}
						<span>After saving you'll get a secret URL. Have your cron job or backup script request it each time it finishes; if the pings stop, Bonk alerts.</span>
					{/if}
				</div>
			{/if}
		</div>

		{#if type === 'keyword'}
			<div class="grid2">
				<label class="field">
					Text to look for
					<input class="input" name="keyword" value={s('keyword')} placeholder="e.g. All good" aria-invalid={err.keyword ? 'true' : undefined} />
					{#if err.keyword}<span class="error">{err.keyword}</span>{/if}
				</label>
				<label class="check check-box align-end">
					<input type="checkbox" name="keyword_invert" checked={on('keyword_invert')} />
					Alert if the text <strong>is</strong> found instead
				</label>
			</div>
		{:else if type === 'json'}
			<div class="grid2">
				<label class="field">
					Path
					<input class="input" name="json_path" value={s('json_path')} placeholder="status or data.checks[0].ok" aria-invalid={err.json_path ? 'true' : undefined} />
					{#if err.json_path}<span class="error">{err.json_path}</span>{:else}<span class="help">Dot and bracket paths into the JSON response.</span>{/if}
				</label>
				<label class="field">
					Expected value
					<input class="input" name="json_expected" value={s('json_expected')} placeholder="ok" />
					<span class="help">Leave empty to accept any truthy value.</span>
				</label>
			</div>
		{:else if type === 'dns'}
			<label class="field">
				Expected answer
				<input class="input" name="dns_expected" value={s('dns_expected')} placeholder="e.g. 203.0.113.7 (optional)" />
				<span class="help">Empty means any answer counts as healthy.</span>
			</label>
		{/if}

		<fieldset class="grid4">
			<legend class="legend">When is it healthy</legend>
			<label class="field">
				{type === 'push' ? 'Expect a ping every' : 'Check every'}
				<select class="select" name="interval_s" value={Number(v.interval_s)}>
					{#each type === 'push' ? PUSH_INTERVALS : INTERVALS as [sec, label] (sec)}<option value={sec}>{label}</option>{/each}
				</select>
			</label>
			{#if isHttp}
				<label class="field">
					Expected status
					<input class="input" name="expected_status" value={s('expected_status')} placeholder="2xx" aria-invalid={err.expected_status ? 'true' : undefined} />
					{#if err.expected_status}<span class="error">{err.expected_status}</span>{/if}
				</label>
			{/if}
			{#if type !== 'push'}
				<label class="field">
					Slow above (ms)
					<input class="input" name="slow_ms" inputmode="numeric" value={s('slow_ms')} placeholder="off" />
				</label>
				<label class="field">
					Timeout (s)
					<input class="input" name="timeout_s" inputmode="numeric" value={String(Number(v.timeout_ms) / 1000)} />
				</label>
			{/if}
			<label class="check inline wide">
				Alert after
				<input class="input narrow" type="number" name="alert_after" min="1" max="20" value={s('alert_after')} aria-label="Failed checks before alerting" />
				<span>failed checks in a row, so one blip doesn't wake anyone up.</span>
			</label>
			<label class="check inline wide">
				Remind every
				<input class="input narrow" type="number" name="resend_min" min="0" max="10080" value={s('resend_min')} aria-label="Reminder interval in minutes" />
				<span>minutes while it stays down (0 = don't).</span>
			</label>
		</fieldset>

		{#if isHttp}
			<details class="advanced" open={hasAdvanced || !!err.headers}>
				<summary class="t-heading">Advanced: headers, body, redirects</summary>
				<div class="adv-body">
					<input type="hidden" name="follow_redirects_present" value="1" />
					<label class="check"><input type="checkbox" name="follow_redirects" checked={on('follow_redirects')} />Follow redirects</label>
					<label class="field">
						Headers (JSON)
						<textarea class="textarea" name="headers" spellcheck="false" aria-invalid={err.headers ? 'true' : undefined}>{s('headers')}</textarea>
						{#if err.headers}<span class="error">{err.headers}</span>{/if}
					</label>
					<label class="field">
						Request body
						<textarea class="textarea" name="body" spellcheck="false" placeholder="Sent with POST, PUT and PATCH">{s('body')}</textarea>
					</label>
				</div>
			</details>
		{/if}

		<fieldset class="stack">
			<legend class="legend">Who hears about it</legend>
			{#each channels as c (c.id)}
				<label class="check check-box">
					<input type="checkbox" name="channels" value={c.id} checked={chosen.has(c.id)} />
					{c.name}<span class="t-muted t-small">· {c.provider}</span>
				</label>
			{:else}
				<p class="t-small t-muted">No channels yet.</p>
			{/each}
			<a href="/admin/notifications" class="t-small">Add a channel</a>
		</fieldset>

		<fieldset class="grid2">
			<legend class="legend">Public status page</legend>
			<label class="check wide"><input type="checkbox" name="public" checked={on('public')} />Show on the status page</label>
			<label class="field">
				Group
				<input class="input" name="group_name" value={s('group_name')} list="groups" placeholder="e.g. API" />
				<datalist id="groups">{#each groups as g (g)}<option value={g}></option>{/each}</datalist>
			</label>
			<label class="field">
				Public name
				<input class="input" name="public_name" value={s('public_name')} placeholder="Defaults to the name" />
			</label>
			<label class="field">
				Order
				<input class="input" name="sort" inputmode="numeric" value={s('sort')} />
				<span class="help">Lower numbers come first.</span>
			</label>
			<label class="check align-end"><input type="checkbox" name="paused" checked={on('paused')} />Paused</label>
		</fieldset>

		<div class="bar">
			<a href={cancelHref} class="btn btn-quiet">Cancel</a>
			{#if type !== 'push'}
				<button class="btn" formaction="?/test" formnovalidate disabled={busy !== null}>{busy === 'test' ? 'Testing…' : 'Test'}</button>
			{/if}
			<button class="btn btn-primary" disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save monitor'}</button>
		</div>
	</form>

	<aside class="panel result" aria-label="Test result" aria-live="polite">
		<div class="panel-head">
			<span class="t-heading">Test result</span>
		</div>
		<div class="panel-body result-body">
			{#if form?.testError}
				<p class="t-small">{form.testError}</p>
			{:else if form?.test}
				{@const t = form.test}
				<div class="big">
					<span class="t-display t-display-m">{t.detail?.status ? `${t.detail.status} ${t.detail.statusText ?? ''}` : t.result === 'up' ? 'OK' : 'Failed'}</span>
					<span class="tag s-{t.result}">{t.result}</span>
				</div>
				<dl class="facts t-small">
					<dt class="t-muted">Response time</dt><dd>{fmtMs(t.latency)}</dd>
					<dt class="t-muted">Result</dt><dd>{t.message}</dd>
					{#if t.detail?.headers?.['content-type']}<dt class="t-muted">Content-Type</dt><dd>{t.detail.headers['content-type']}</dd>{/if}
				</dl>
				{#if t.detail?.body}
					<div class="stack-s">
						<span class="t-label">Body (start)</span>
						<pre class="code">{t.detail.body.slice(0, 600)}</pre>
					</div>
				{/if}
				<p class="t-small">
					{#if t.result === 'up'}Healthy, as configured.{:else if t.result === 'degraded'}This would count as <strong>degraded</strong>: it worked, but slowly.{:else}This would count as <strong>down</strong>.{/if}
				</p>
			{:else}
				<p class="t-small t-muted">Press Test to run this check once from Cloudflare without saving. Nothing is recorded.</p>
			{/if}
		</div>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 380px;
		gap: 48px;
		align-items: start;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 32px;
		min-width: 0;
	}
	.types {
		flex-wrap: wrap;
	}
	.types > label {
		min-width: 110px;
	}
	.grid2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px 20px;
	}
	.grid4 {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px 20px;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.inline {
		gap: 10px;
	}
	.inline span {
		flex: 1;
	}
	.narrow {
		width: 72px;
		min-height: 40px;
	}
	.align-end {
		align-self: end;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.push {
		word-break: break-all;
	}
	.advanced {
		border-top: 1px solid var(--bonk-line);
		border-bottom: 1px solid var(--bonk-line);
		padding: 14px 0;
	}
	.advanced summary {
		cursor: pointer;
		font-size: 15px;
		min-height: 24px;
	}
	.adv-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-top: 16px;
	}
	.bar {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		border-top: 1.5px solid var(--bonk-ink);
		padding-top: 20px;
	}
	.result {
		position: sticky;
		top: 24px;
	}
	.result-body {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.big {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.facts {
		margin: 0;
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		gap: 8px 12px;
	}
	.facts dd {
		margin: 0;
		word-break: break-word;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.result {
			position: static;
		}
	}
	@media (max-width: 700px) {
		.grid2,
		.grid4 {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
