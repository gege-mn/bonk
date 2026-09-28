<script lang="ts">
	import { enhance } from '$app/forms';
	import ChannelForm from '$lib/components/ChannelForm.svelte';

	let { data, form } = $props();
	const pname = (id: string) => data.providers.find((p) => p.id === id)?.name ?? id;
	const pmono = (id: string) => data.providers.find((p) => p.id === id)?.mono ?? '··';
	const queued = (id: number) => data.queue.find((q) => q.channel_id === id);
</script>

<div class="layout">
	<section class="left">
		<div class="title">
			<h1 class="t-display t-display-l">Notifications</h1>
			<p class="t-small t-muted">Where alerts go when a monitor goes down, gets slow, or recovers.</p>
		</div>

		<div class="rows">
			{#each data.channels as c (c.id)}
				{@const q = queued(c.id)}
				<div class="ch">
					<span class="mono">{pmono(c.provider)}</span>
					<a class="info" href="/admin/notifications/{c.id}">
						<span class="t-heading">{c.name}</span>
						<span class="t-xs t-muted">{pname(c.provider)} · on for {c.monitors} monitor{c.monitors === 1 ? '' : 's'}{c.default_on ? ' · on by default' : ''}</span>
						{#if q}<span class="t-xs warn">{q.n} alert{q.n === 1 ? '' : 's'} waiting to retry: {q.err}</span>{/if}
					</a>
					<form method="POST" action="?/test" use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<button class="btn btn-sm">Send test</button>
					</form>
				</div>
				{#if form && 'tested' in form && form.tested === c.id}
					<p class="t-small result" class:bad={!form.testOk}>{form.testOk ? 'Sent. Check the channel.' : `Failed: ${form.testError}`}</p>
				{/if}
			{:else}
				<p class="empty">No channels yet. Add one on the right, then send a test.</p>
			{/each}
		</div>

		<div class="preview">
			<span class="t-label">What an alert looks like</span>
			<pre class="panel msg">{data.preview}</pre>
		</div>
	</section>

	<section class="panel add" aria-label="Add a channel">
		<div class="panel-head"><h2 class="t-heading">Add a channel</h2></div>
		<div class="panel-body">
			{#if form && 'error' in form && form.error}<p class="t-small bad">{form.error}</p>{/if}
			<ChannelForm providers={data.providers} submitLabel="Save channel" errors={form && 'errors' in form ? (form.errors ?? {}) : {}} showApplyAll />
		</div>
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 520px;
		gap: 48px;
		align-items: start;
	}
	.left {
		display: flex;
		flex-direction: column;
		gap: 24px;
		min-width: 0;
	}
	.title {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ch {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) auto;
		gap: 16px;
		align-items: center;
		padding: 16px 0;
	}
	.mono {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		background: var(--bonk-ink);
		color: var(--bonk-bg);
		border-radius: var(--bonk-radius-sm);
		font-family: var(--bonk-font-heading);
		font-weight: 700;
		font-size: 14px;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		color: var(--bonk-ink);
		text-decoration: none;
		min-width: 0;
	}
	.info .t-heading {
		font-size: 17px;
	}
	.warn,
	.bad {
		color: var(--bonk-down);
	}
	.result {
		padding: 8px 0;
		border-bottom: 0 !important;
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.msg {
		margin: 0;
		padding: 16px 18px;
		font-family: var(--bonk-font-body);
		font-size: 13px;
		line-height: 1.6;
		white-space: pre-wrap;
		max-width: 460px;
		border-width: 1px;
	}
	.add h2 {
		font-size: 18px;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
