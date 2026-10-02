<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/admin', label: 'Monitors', icon: 'M3 12h4l3-8 4 16 3-8h4', match: (p: string) => p === '/admin' || p.startsWith('/admin/monitors') },
		{ href: '/admin/pages', label: 'Status pages', icon: 'M4 4h16v16H4zM4 9h16M9 9v11', match: (p: string) => p.startsWith('/admin/pages') },
		{ href: '/admin/incidents', label: 'Incidents', icon: 'M12 3l9 16H3zM12 10v4M12 17v.5', match: (p: string) => p.startsWith('/admin/incidents') },
		{ href: '/admin/notifications', label: 'Notifications', icon: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', match: (p: string) => p.startsWith('/admin/notifications') },
		{ href: '/admin/maintenance', label: 'Maintenance', icon: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', match: (p: string) => p.startsWith('/admin/maintenance') },
		{ href: '/admin/settings', label: 'Settings', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4', match: (p: string) => p.startsWith('/admin/settings') }
	];
	const path = $derived(page.url.pathname);
</script>

<svelte:head><title>{data.appearance.site.name} · admin</title></svelte:head>

<div class="shell">
	<aside class="side">
		<a href="/admin" class="brand">
			<Logo size={26} src={data.appearance.logo} onInk />
			<span class="t-heading brand-name">{data.appearance.site.name}</span>
			<span class="t-small dim">/ uptime</span>
		</a>
		<nav class="nav" aria-label="Admin">
			{#each nav as n (n.href)}
				<a href={n.href} aria-current={n.match(path) ? 'page' : undefined}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d={n.icon} /></svg>
					{n.label}
					{#if n.label === 'Monitors'}<span class="count t-xs">{data.monitorCount}</span>{/if}
				</a>
			{/each}
		</nav>
		<a class="view" href="/" target="_blank" rel="noopener">View status page ↗</a>
		<div class="who t-xs">
			{#if data.admin?.via === 'access'}
				<span>{data.admin.email ?? 'Signed in'}</span>
				<span class="dim">Signed in with Cloudflare Access</span>
				<a href="/cdn-cgi/access/logout">Sign out</a>
			{:else}
				<span>Admin</span>
				<form method="POST" action="/admin/logout"><button class="linkish">Sign out</button></form>
			{/if}
		</div>
	</aside>
	<main class="main">
		{#if data.checkerStale}
			<div class="notice notice-warn t-small checker">
				<span>
					<strong>{data.checkerLastRun ? 'The checker has stopped running.' : "The checker hasn't run yet."}</strong>
					Checks run on a Cloudflare Cron Trigger, which can take up to 15 minutes to start after the first deploy.
					If it stays like this, re-apply the trigger with <code>pnpm wrangler triggers deploy</code> (see the README).
				</span>
			</div>
		{/if}
		{#if data.encryptionMissing}
			<div class="notice notice-warn t-small">
				<span><strong>ENCRYPTION_KEY is not set.</strong> Notification credentials are stored unencrypted. Add it under
					Workers → Settings → Variables and Secrets, then re-save your channels.</span>
			</div>
		{/if}
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr);
		min-height: 100vh;
		/* Keeps the sidebar column dark below the sticky panel on long pages. */
		background: linear-gradient(to right, var(--bonk-ink) 248px, var(--bonk-bg) 248px);
	}
	.side {
		background: var(--bonk-ink);
		color: var(--bonk-bg);
		display: flex;
		flex-direction: column;
		padding: 28px 16px 24px;
		gap: 28px;
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		color: var(--bonk-bg);
		text-decoration: none;
	}
	.brand-name {
		font-size: 19px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dim {
		color: color-mix(in srgb, var(--bonk-bg) 62%, var(--bonk-ink));
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 14px;
	}
	.nav a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: var(--bonk-radius-sm);
		color: color-mix(in srgb, var(--bonk-bg) 85%, var(--bonk-ink));
		text-decoration: none;
	}
	.nav a:hover {
		background: color-mix(in srgb, var(--bonk-bg) 6%, var(--bonk-ink));
		color: var(--bonk-bg);
	}
	.nav a[aria-current='page'] {
		background: color-mix(in srgb, var(--bonk-bg) 10%, var(--bonk-ink));
		color: var(--bonk-bg);
	}
	.count {
		margin-left: auto;
		color: color-mix(in srgb, var(--bonk-bg) 62%, var(--bonk-ink));
	}
	.view {
		padding: 0 12px;
		font-size: 13px;
		color: color-mix(in srgb, var(--bonk-bg) 85%, var(--bonk-ink));
	}
	.who {
		margin-top: auto;
		padding: 16px 12px 0;
		border-top: 1px solid color-mix(in srgb, var(--bonk-bg) 18%, var(--bonk-ink));
		display: flex;
		flex-direction: column;
		gap: 4px;
		word-break: break-all;
	}
	.who a,
	.linkish {
		color: color-mix(in srgb, var(--bonk-bg) 85%, var(--bonk-ink));
		background: none;
		border: 0;
		padding: 4px 0;
		font: inherit;
		text-align: left;
		text-decoration: underline;
		cursor: pointer;
	}
	.main {
		padding: 40px 48px 56px;
		display: flex;
		flex-direction: column;
		gap: 28px;
		min-width: 0;
		max-width: 1440px;
	}
	@media (max-width: 900px) {
		.shell {
			grid-template-columns: minmax(0, 1fr);
			background: var(--bonk-bg);
		}
		.side {
			position: static;
			height: auto;
			padding: 16px;
			gap: 12px;
		}
		.nav {
			flex-direction: row;
			overflow-x: auto;
		}
		.nav a {
			padding: 10px 12px;
			white-space: nowrap;
		}
		.view,
		.who {
			display: none;
		}
		.main {
			padding: 24px 16px 40px;
		}
	}
</style>
