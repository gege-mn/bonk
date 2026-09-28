<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();
	const tabs = [
		{ href: '/admin/settings', label: 'General' },
		{ href: '/admin/settings/appearance', label: 'Appearance' }
	];
</script>

<div class="head">
	<h1 class="t-display t-display-l">Settings</h1>
	<nav class="tabs t-small" aria-label="Settings sections">
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={page.url.pathname === t.href ? 'page' : undefined}>{t.label}</a>
		{/each}
	</nav>
</div>
{@render children()}

<style>
	.head {
		display: flex;
		flex-direction: column;
		gap: 14px;
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
