<script lang="ts">
	import { enhance } from '$app/forms';
	import HistoryBars from '$lib/components/HistoryBars.svelte';
	import ResponseChart from '$lib/components/ResponseChart.svelte';
	import { fmtInterval, fmtMs, fmtTime, fmtWhen, STATUS_LABEL } from '$lib/format';

	let { data, form } = $props();

	const m = $derived(data.monitor);
	const st = $derived(m.paused ? 'paused' : data.state.status);
	const TYPE: Record<string, string> = { http: 'HTTP', keyword: 'Keyword', json: 'JSON', tcp: 'TCP', dns: 'DNS', push: 'Push' };

	const describe = $derived.by(() => {
		const parts = [m.type === 'push' ? 'Push' : `${TYPE[m.type]}${m.type === 'http' || m.type === 'keyword' || m.type === 'json' ? ' ' + m.method : ''}`];
		if (m.type !== 'push') parts.push(m.target);
		parts.push(m.type === 'push' ? `expects a ping every ${fmtInterval(m.interval_s)}` : `every ${fmtInterval(m.interval_s)}`);
		if (m.slow_ms) parts.push(`slow above ${fmtMs(m.slow_ms)}`);
		return parts.join(' · ');
	});

	const chart = $derived.by(() => {
		const now = data.now;
		if (data.range === '1h') {
			const pts = data.recent.filter((r) => r.ts > now - 3600).map((r) => ({ ts: r.ts, v: r.latency }));
			return { points: pts, from: now - 3600, to: now, labels: ['60 min ago', '45', '30', '15', 'Now'] };
		}
		if (data.range === '30d') {
			const from = now - 30 * 86400;
			return { points: data.days.filter((d) => d.ts >= from).map((d) => ({ ts: d.ts + 43200, v: d.avg })), from, to: now, labels: ['30 days ago', '', '15 days', '', 'Today'] };
		}
		const span = data.range === '7d' ? 7 * 86400 : 86400;
		const from = now - span;
		const pts = data.hours.filter((h) => h.ts >= from - 3600).map((h) => ({ ts: Math.min(h.ts + 1800, now), v: h.avg }));
		const labels = data.range === '7d' ? ['7 days ago', '', '', '', 'Now'] : [fmtTime(from).replace(' UTC', ''), fmtTime(from + 21600).replace(' UTC', ''), fmtTime(from + 43200).replace(' UTC', ''), fmtTime(from + 64800).replace(' UTC', ''), 'Now'];
		return { points: pts, from, to: now, labels };
	});

	const beats = $derived([...Array(Math.max(0, 60 - data.recent.length)).fill(null), ...data.recent.slice(-60)]);
	const EVENT: Record<string, string> = { up: 'Up', down: 'Down', degraded: 'Degraded', notified: 'Alert sent', notify_failed: 'Alert failed' };
	let confirmDelete = $state(false);
</script>

<a href="/admin" class="back t-small">← Monitors</a>

<div class="head">
	<div class="title">
		<div class="title-row">
			<h1 class="t-display t-display-l">{m.name}</h1>
			<span class="tag s-{st}">{STATUS_LABEL[st]}</span>
		</div>
		<span class="t-small t-muted desc">{describe}</span>
	</div>
	<div class="actions">
		{#if !m.paused}
			<form method="POST" action="?/check" use:enhance><button class="btn">Check now</button></form>
		{/if}
		<form method="POST" action="?/pause" use:enhance><button class="btn">{m.paused ? 'Resume' : 'Pause'}</button></form>
		<a class="btn btn-primary" href="/admin/monitors/{m.id}/edit">Edit</a>
	</div>
</div>

{#if m.type === 'push' && m.push_token}
	<div class="notice t-small">
		<span>Ping URL — request it when your job runs: <code class="push">{data.origin}/api/push/{m.push_token}</code></span>
	</div>
{/if}

<div class="stats">
	<div><span class="t-label">Now</span><span class="t-heading v" class:slow={data.state.status === 'degraded'}>{m.type === 'push' ? (data.state.last_message ?? '—') : fmtMs(data.state.last_latency)}</span></div>
	<div><span class="t-label">Average 24 h</span><span class="t-heading v">{fmtMs(data.avg24)}</span></div>
	<div><span class="t-label">Uptime 24 h</span><span class="t-heading v">{data.uptime24}</span></div>
	<div><span class="t-label">Uptime 30 d</span><span class="t-heading v">{data.uptime30}</span></div>
	<div><span class="t-label">Uptime 90 d</span><span class="t-heading v">{data.uptime90}</span></div>
</div>

{#if data.state.last_message && m.type !== 'push'}
	<p class="t-small last">Last check {data.state.last_check_at ? fmtWhen(data.state.last_check_at, data.now) : ''}: {data.state.last_message}</p>
{/if}

{#if m.type !== 'push'}
	<section class="sec">
		<div class="sec-head">
			<h2 class="t-heading">Response time</h2>
			<nav class="segmented segmented-sm" aria-label="Range">
				{#each ['1h', '24h', '7d', '30d'] as r (r)}
					<a href="?range={r}" aria-current={data.range === r ? 'true' : undefined} data-sveltekit-noscroll>{r.replace('h', ' h').replace('d', ' d')}</a>
				{/each}
			</nav>
		</div>
		<ResponseChart {...chart} threshold={m.slow_ms} />
	</section>
{/if}

<section class="two">
	<div class="sec">
		<h2 class="t-heading">Last 60 checks</h2>
		<div class="bars bars-l">
			{#each beats as b, i (i)}
				<span class="s-{b ? b.result : 'none'}" data-tip={b ? `${fmtTime(b.ts)}\n${b.result}${b.latency !== null ? ` · ${fmtMs(b.latency)}` : ''}` : undefined}></span>
			{/each}
		</div>
		<div class="axis t-xs t-muted"><span>Older</span><span>Now</span></div>
		<h2 class="t-heading sub">90 days</h2>
		<HistoryBars bars={data.bars} size="s" />
		<div class="axis t-xs t-muted"><span>90 days ago</span><span>Today</span></div>
	</div>
	<div class="sec">
		<h2 class="t-heading">Events</h2>
		<div class="events">
			{#each data.events as e, i (i)}
				<div class="ev t-small">
					<span class="t-muted">{fmtWhen(e.ts, data.now)}</span>
					<span class="kind k-{e.kind}">{EVENT[e.kind] ?? e.kind}</span>
					<span class="msg">{e.message}</span>
				</div>
			{:else}
				<p class="t-small t-muted">Nothing yet. Status changes and alerts show up here.</p>
			{/each}
		</div>
	</div>
</section>

<section class="sec danger">
	<h2 class="t-heading">Alerts go to</h2>
	<p class="t-small">
		{#if data.channels.length}{data.channels.map((c) => `${c.name} (${c.provider})`).join(', ')}{:else}Nobody — <a href="/admin/monitors/{m.id}/edit">pick channels</a>.{/if}
	</p>
	<form method="POST" action="?/delete" class="del" use:enhance>
		<label class="check t-small"><input type="checkbox" name="confirm" value="yes" bind:checked={confirmDelete} />Delete this monitor and its history</label>
		<button class="btn btn-danger btn-sm" disabled={!confirmDelete}>Delete</button>
		{#if form && 'deleteError' in form && form.deleteError}<span class="t-small">{form.deleteError}</span>{/if}
	</form>
</section>

<style>
	.back {
		align-self: flex-start;
	}
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
		min-width: 0;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.desc {
		word-break: break-all;
	}
	.actions {
		display: flex;
		gap: 10px;
	}
	.push {
		word-break: break-all;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border-top: 1.5px solid var(--bonk-ink);
		border-bottom: 1px solid var(--bonk-line);
	}
	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 18px 20px 18px 0;
		min-width: 0;
	}
	.v {
		font-size: 26px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.slow {
		color: color-mix(in srgb, var(--bonk-degraded) 55%, var(--bonk-ink));
	}
	.last {
		margin-top: -12px;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.sec h2 {
		font-size: 16px;
	}
	.sec-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.two {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 40px;
	}
	.sub {
		margin-top: 12px;
	}
	.axis {
		display: flex;
		justify-content: space-between;
	}
	.events {
		display: flex;
		flex-direction: column;
		max-height: 420px;
		overflow: auto;
	}
	.ev {
		display: grid;
		grid-template-columns: 110px 100px minmax(0, 1fr);
		gap: 14px;
		padding: 9px 0;
		border-top: 1px solid var(--bonk-line);
		align-items: baseline;
	}
	.kind {
		font-weight: 700;
	}
	.k-notified {
		color: var(--bonk-accent);
	}
	.k-down,
	.k-notify_failed {
		color: var(--bonk-down);
	}
	.k-degraded {
		color: color-mix(in srgb, var(--bonk-degraded) 55%, var(--bonk-ink));
	}
	.msg {
		word-break: break-word;
	}
	.danger {
		border-top: 1px solid var(--bonk-line);
		padding-top: 20px;
	}
	.del {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	@media (max-width: 900px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.two {
			grid-template-columns: minmax(0, 1fr);
		}
		.ev {
			grid-template-columns: 90px minmax(0, 1fr);
		}
		.ev .msg {
			grid-column: 1 / -1;
		}
	}
</style>
