<script lang="ts">
	import { fmtMs } from '$lib/format';

	let { data } = $props();
	let q = $state('');

	const TYPE: Record<string, string> = { http: 'HTTP', keyword: 'Keyword', json: 'JSON', tcp: 'TCP', dns: 'DNS', push: 'Push' };

	const rows = $derived(
		data.monitors.filter((m) => {
			const s = q.trim().toLowerCase();
			return !s || m.name.toLowerCase().includes(s) || m.target.toLowerCase().includes(s) || m.group_name.toLowerCase().includes(s);
		})
	);
	const count = (st: string) => data.monitors.filter((m) => !m.paused && m.state.status === st).length;
	const paused = $derived(data.monitors.filter((m) => m.paused).length);

	const statusOf = (m: (typeof data.monitors)[number]) => (m.paused ? 'paused' : m.state.status);
	const pad = (r: { result: string }[]) => [...Array(Math.max(0, 40 - r.length)).fill(null), ...r];
</script>

<div class="head">
	<div class="title">
		<h1 class="t-display t-display-l">Monitors</h1>
		{#if data.monitors.length}
			<div class="counts t-small">
				<span><i class="swatch s-up"></i>{count('up')} up</span>
				<span><i class="swatch s-degraded"></i>{count('degraded')} degraded</span>
				<span><i class="swatch s-down"></i>{count('down')} down</span>
				{#if paused}<span class="t-muted"><i class="swatch s-paused"></i>{paused} paused</span>{/if}
			</div>
		{/if}
	</div>
	<div class="actions">
		{#if data.monitors.length > 5}
			<label class="search">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
				<span class="vh">Filter monitors</span>
				<input type="search" bind:value={q} placeholder="Filter by name or URL" />
			</label>
		{/if}
		<a class="btn btn-primary" href="/admin/monitors/new">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			New monitor
		</a>
	</div>
</div>

{#if !data.monitors.length}
	<div class="panel onboarding">
		<h2 class="t-heading">Nothing is being watched yet</h2>
		<p class="t-small">
			Add a URL and Bonk checks it every minute from Cloudflare's network. When it goes down, you'll hear about it on the channels
			you connect under <a href="/admin/notifications">Notifications</a>.
		</p>
		<a class="btn btn-primary" href="/admin/monitors/new">Add your first monitor</a>
	</div>
{:else}
	<div class="table" role="table" aria-label="Monitors">
		<div class="tr th t-label" role="row">
			<span role="columnheader">Name</span>
			<span role="columnheader">Type</span>
			<span role="columnheader">Last 40 checks</span>
			<span role="columnheader" class="num">Response</span>
			<span role="columnheader" class="num">30 days</span>
		</div>
		{#each rows as m (m.id)}
			<a class="tr" role="row" href="/admin/monitors/{m.id}" class:paused={m.paused}>
				<span class="name-cell" role="cell">
					<span class="swatch s-{statusOf(m)}"></span>
					<span class="name-text">
						<span class="t-heading name">{m.name}{#if !m.public}<span class="t-xs t-muted private"> · private</span>{/if}</span>
						<span class="t-xs t-muted target">{m.type === 'push' ? `Push · expects a ping every ${Math.round(m.interval_s / 60)} min` : m.target}</span>
					</span>
				</span>
				<span class="t-xs t-muted" role="cell">{TYPE[m.type]}</span>
				<span class="bars bars-s" role="cell" aria-label="Last 40 checks">
					{#each pad(m.recent) as c, i (i)}
						<span class="s-{c ? c.result : 'none'}"></span>
					{/each}
				</span>
				<span class="num t-small t-num" role="cell" class:slow={m.state.status === 'degraded'}>{m.paused ? '—' : fmtMs(m.state.last_latency)}</span>
				<span class="num t-small t-num strong" role="cell">{m.uptime30}</span>
			</a>
		{:else}
			<p class="empty">No monitor matches “{q}”.</p>
		{/each}
	</div>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		flex-wrap: wrap;
	}
	.title {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.counts {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
	}
	.counts span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 14px;
		width: 260px;
		border: 1px solid color-mix(in srgb, var(--bonk-line) 60%, var(--bonk-muted));
		border-radius: var(--bonk-radius-sm);
		background: var(--bonk-surface);
		color: var(--bonk-muted);
	}
	.search input {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 13px;
		outline: none;
		width: 100%;
		color: var(--bonk-ink);
	}
	.onboarding {
		padding: 32px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: flex-start;
		max-width: 640px;
	}
	.onboarding h2 {
		font-size: 22px;
	}
	.table {
		display: flex;
		flex-direction: column;
		border-top: 1.5px solid var(--bonk-ink);
	}
	.tr {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) 80px minmax(200px, 300px) 100px 90px;
		gap: 20px;
		padding: 12px 0;
		align-items: center;
		border-bottom: 1px solid var(--bonk-line);
		color: var(--bonk-ink);
		text-decoration: none;
	}
	a.tr:hover {
		background: color-mix(in srgb, var(--bonk-ink) 3%, transparent);
	}
	.th {
		padding: 12px 0;
	}
	.paused {
		opacity: 0.6;
	}
	.name-cell {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}
	.name-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-size: 16px;
	}
	.private {
		font-weight: 400;
	}
	.target {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.num {
		text-align: right;
	}
	.strong {
		font-weight: 700;
	}
	.slow {
		color: color-mix(in srgb, var(--bonk-degraded) 55%, var(--bonk-ink));
		font-weight: 700;
	}
	@media (max-width: 900px) {
		.tr {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.tr > :nth-child(2),
		.tr > :nth-child(3),
		.th > :nth-child(4) {
			display: none;
		}
		.tr > :nth-child(4) {
			display: none;
		}
		.search {
			width: 100%;
		}
	}
</style>
