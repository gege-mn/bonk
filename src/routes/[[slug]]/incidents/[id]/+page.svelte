<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { fmtDate, fmtDuration, fmtTime } from '$lib/format';

	let { data } = $props();
	const i = $derived(data.incident);
	const sp = $derived(data.statusPage);
</script>

<svelte:head><title>{i.title} · {sp.name} status</title></svelte:head>

<div class="page">
	<a href={sp.base || '/'} class="brand">
		<Logo size={26} src={data.appearance.logo} />
		<span class="t-heading">{sp.name}</span>
		<span class="t-small t-muted">/ status</span>
	</a>
	<div class="head">
		<span class="tag s-{i.resolved_at ? 'up' : i.severity === 'info' ? 'maintenance' : i.severity}">
			{i.resolved_at ? 'Resolved' : i.severity === 'down' ? 'Outage' : i.severity === 'degraded' ? 'Degraded' : 'Notice'}
		</span>
		<h1 class="t-display t-display-l">{i.title}</h1>
		<p class="t-small t-muted">
			{fmtDate(i.started_at)} {fmtTime(i.started_at)}
			{#if i.resolved_at}· lasted {fmtDuration(i.resolved_at - i.started_at)}{/if}
		</p>
	</div>
	<ol class="rows timeline">
		{#each data.updates as u (u.id)}
			<li>
				<span class="t-muted t-small">{fmtDate(u.ts, false)} {fmtTime(u.ts)}</span>
				<span><strong class="cap">{u.status}.</strong> {u.body}</span>
			</li>
		{/each}
	</ol>
	<a href={sp.base || '/'} class="t-small">← All services</a>
</div>

<style>
	.page {
		max-width: 860px;
		margin: 0 auto;
		padding: 48px 24px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--bonk-ink);
		text-decoration: none;
		font-size: 19px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.timeline {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.timeline li {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		gap: 16px;
		padding: 16px 0;
		font-size: 15px;
	}
	.cap {
		text-transform: capitalize;
	}
	@media (max-width: 640px) {
		.timeline li {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
	}
</style>
