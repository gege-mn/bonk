<script lang="ts">
	import HistoryBars from '$lib/components/HistoryBars.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { fmtDate, fmtDuration, fmtTime, STATUS_LABEL } from '$lib/format';
	import { headline } from '$lib/headline';

	import type { PageLink } from '$lib/server/pages';
	import type { pageStatus } from '$lib/server/repo';
	import type { Appearance } from '$lib/server/settings';

	let {
		appearance,
		page: site,
		status: s
	}: {
		appearance: Pick<Appearance, 'logo'>;
		/** `base` prefixes the page's own links ('' for the default page); `private` pages are behind the sign-in. */
		page: { name: string; description: string; links: PageLink[]; base: string; private: boolean };
		status: Awaited<ReturnType<typeof pageStatus>>;
	} = $props();

	const h = $derived(headline(s.monitors, s.openIncidents, s.maintenance.some((m) => m.active)));
</script>

<svelte:head>
	<title>{site.name} status{site.private ? ' · private' : ''}</title>
	<meta name="description" content={site.description || `Live status of ${site.name} services.`} />
</svelte:head>

<div class="page">
	<header class="top">
		<a href={site.base || '/'} class="brand">
			<Logo size={30} src={appearance.logo} />
			<span class="t-heading brand-name">{site.name}</span>
			<span class="t-small t-muted">/ status</span>
			{#if site.private}<span class="tag s-paused">Private</span>{/if}
		</a>
		<nav class="links t-small">
			{#if s.pastIncidents.length}<a href="#history">History</a>{/if}
			{#each site.links as l (l.href)}<a href={l.href}>{l.label}</a>{/each}
		</nav>
	</header>

	<section class="hero">
		<div class="updated t-small t-muted">
			<span class="swatch s-{h.status}"></span>
			<span>
				{#if s.checkedAt}Updated {fmtTime(s.checkedAt)} · refreshes every minute{:else}No checks yet{/if}
			</span>
		</div>
		<h1 class="t-display t-display-xl">{h.title}</h1>
		{#if h.sub || site.description}
			<p class="lede">{h.sub || site.description}</p>
		{/if}
	</section>

	{#each s.maintenance as m (m.id)}
		<section class="panel incident" aria-label="Maintenance">
			<div class="incident-meta">
				<span class="tag s-maintenance">{m.active ? 'In progress' : 'Scheduled'}</span>
				<span class="t-small t-muted">{fmtDate(m.starts_at, false)} {fmtTime(m.starts_at)} – {fmtTime(m.ends_at)}</span>
			</div>
			<div class="incident-body">
				<h2 class="t-heading incident-title">{m.title}</h2>
				{#if m.body}<p class="t-small">{m.body}</p>{/if}
			</div>
		</section>
	{/each}

	{#each s.openIncidents as inc (inc.id)}
		<section class="panel incident" aria-label="Active incident">
			<div class="incident-meta">
				<span class="tag s-{inc.severity === 'info' ? 'maintenance' : inc.severity}">
					{inc.severity === 'down' ? 'Outage' : inc.severity === 'degraded' ? 'Degraded' : 'Notice'}
				</span>
				<span class="t-small t-muted">since {fmtTime(inc.started_at)}</span>
			</div>
			<div class="incident-body">
				<h2 class="t-heading incident-title"><a href="{site.base}/incidents/{inc.id}">{inc.title}</a></h2>
				<ol class="updates">
					{#each inc.updates.slice(0, 3) as u (u.id)}
						<li>
							<span class="t-muted">{fmtTime(u.ts)}</span>
							<span><strong class="cap">{u.status}.</strong> {u.body}</span>
						</li>
					{/each}
				</ol>
			</div>
		</section>
	{/each}

	{#if s.monitors.length}
		<section class="groups">
			{#each s.groups as g (g.name)}
				<div class="group">
					{#if g.name}<h2 class="t-eyebrow group-name">{g.name}</h2>{/if}
					{#each g.monitors as m (m.id)}
						<div class="row">
							<div class="row-name">
								<span class="t-heading name">{m.name}</span>
								<span class="t-xs state state-{m.status}">{STATUS_LABEL[m.status]}</span>
							</div>
							<HistoryBars bars={m.bars} label="{m.name}: last 90 days" />
							<span class="uptime t-num">{m.uptime}</span>
						</div>
					{/each}
				</div>
			{/each}
			<div class="row key-row t-xs t-muted">
				<span></span>
				<div class="legend-mid">
					<span><span class="d90">90</span><span class="d45">45</span> days ago</span>
					<div class="keys">
						<span><i class="swatch s-up"></i>Up</span>
						<span><i class="swatch s-degraded"></i>Degraded</span>
						<span><i class="swatch s-down"></i>Down</span>
						<span><i class="swatch s-none"></i>No data</span>
					</div>
					<span>Today</span>
				</div>
				<span class="uptime">90-day</span>
			</div>
		</section>
	{/if}

	{#if s.pastIncidents.length}
		<section id="history" class="history">
			<h2 class="t-display t-display-m">Past incidents</h2>
			<div>
				{#each s.pastIncidents as i (i.id)}
					<a class="past" href="{site.base}/incidents/{i.id}">
						<span class="t-muted">{fmtDate(i.started_at)}</span>
						<span class="t-heading past-title">{i.title}</span>
						<span class="t-muted dur">{i.resolved_at ? fmtDuration(i.resolved_at - i.started_at) : ''}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<footer class="foot t-xs t-muted">
		<span>Powered by <a href="https://github.com/gege-mn/bonk">Bonk</a> · open source, Apache-2.0</span>
		<a href="{site.base}/api/status.json">JSON</a>
	</footer>
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 48px 96px 56px;
		display: flex;
		flex-direction: column;
		gap: 56px;
		min-height: 100vh;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--bonk-ink);
		text-decoration: none;
	}
	.brand-name {
		font-size: 22px;
	}
	.links {
		display: flex;
		gap: 28px;
	}
	.hero {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.updated {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.hero h1 {
		max-width: 980px;
	}
	.lede {
		font-size: 16px;
		max-width: 640px;
	}
	.incident {
		padding: 28px 32px;
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: 24px 40px;
	}
	.incident-meta {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.incident-body {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.incident-title {
		font-size: 24px;
	}
	.incident-title a {
		color: inherit;
		text-decoration: none;
	}
	.updates {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 14px;
		font-size: 14px;
	}
	.updates li {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: 16px;
	}
	.cap {
		text-transform: capitalize;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 40px;
	}
	.group {
		display: flex;
		flex-direction: column;
	}
	.group-name {
		margin-bottom: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr) 96px;
		gap: 24px;
		align-items: center;
		padding: 12px 0;
		border-top: 1px solid var(--bonk-line);
	}
	.row-name {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-size: 17px;
	}
	.state {
		color: var(--bonk-muted);
	}
	.state-down {
		color: var(--bonk-down);
		font-weight: 700;
	}
	.state-degraded {
		color: color-mix(in srgb, var(--bonk-degraded) 55%, var(--bonk-ink));
		font-weight: 700;
	}
	.uptime {
		text-align: right;
		font-weight: 700;
		font-size: 14px;
	}
	.key-row {
		border-top: 0;
		padding-top: 0;
	}
	.key-row .uptime {
		font-weight: 400;
		font-size: 12px;
	}
	.legend-mid {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.keys {
		display: flex;
		gap: 18px;
	}
	.keys span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.history {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.past {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr) 140px;
		gap: 24px;
		padding: 16px 0;
		border-top: 1px solid var(--bonk-line);
		color: var(--bonk-ink);
		text-decoration: none;
		font-size: 14px;
		align-items: baseline;
	}
	.past-title {
		font-weight: 500;
		font-size: 17px;
	}
	.dur {
		text-align: right;
	}
	.d45 {
		display: none;
	}
	.foot {
		margin-top: auto;
		display: flex;
		justify-content: space-between;
		border-top: 1px solid var(--bonk-line);
		padding-top: 20px;
	}

	@media (max-width: 900px) {
		.page {
			padding: 20px 20px 32px;
			gap: 36px;
		}
		.incident {
			grid-template-columns: minmax(0, 1fr);
			padding: 20px;
			gap: 16px;
		}
		.incident-meta {
			flex-direction: row;
			align-items: center;
		}
		.updates li {
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
		}
		.row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 8px 12px;
		}
		.row :global(.bars) {
			grid-column: 1 / -1;
			grid-row: 2;
			height: 24px;
		}
		.row :global(.bars > :nth-child(-n + 45)) {
			display: none;
		}
		.key-row {
			grid-template-columns: minmax(0, 1fr);
		}
		.key-row > span:first-child,
		.key-row .uptime,
		.keys {
			display: none;
		}
		.d90 {
			display: none;
		}
		.d45 {
			display: inline !important;
		}
		.past {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
		.past .dur {
			text-align: left;
		}
		.links {
			gap: 18px;
		}
	}
</style>
