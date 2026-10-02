<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
	const pg = $derived(data.pg);
	const addr = $derived(pg.is_default ? '/' : `/${pg.slug}`);
	const tabs = $derived([
		{ href: `/admin/pages/${pg.id}`, label: 'Details' },
		{ href: `/admin/pages/${pg.id}/monitors`, label: 'Monitors' },
		{ href: `/admin/pages/${pg.id}/appearance`, label: 'Appearance' }
	]);
</script>

<a href="/admin/pages" class="back t-small">← Status pages</a>
<div class="head">
	<span class="tags">
		<span class="tag {pg.public ? 's-up' : 's-none'}">{pg.public ? 'Public' : 'Private'}</span>
		{#if pg.is_default}<span class="tag s-maintenance">Default</span>{/if}
	</span>
	<h1 class="t-display t-display-l">{pg.name}</h1>
	<a class="t-small addr" href={addr} target="_blank" rel="noopener">{addr} ↗</a>
	<nav class="tabs t-small" aria-label="Status page sections">
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={page.url.pathname === t.href ? 'page' : undefined}>{t.label}</a>
		{/each}
	</nav>
</div>
{@render children()}

<style>
	.back {
		align-self: flex-start;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.tags {
		display: flex;
		gap: 6px;
	}
	.addr {
		align-self: flex-start;
	}
	.tabs {
		display: flex;
		gap: 24px;
		border-bottom: 1px solid var(--bonk-line);
	}
	.tabs a {
		padding: 8px 0;
		color: var(--bonk-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.tabs a[aria-current='page'] {
		color: var(--bonk-ink);
		font-weight: 700;
		border-bottom-color: var(--bonk-accent);
	}
</style>
