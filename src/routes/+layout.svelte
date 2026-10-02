<script lang="ts">
	import '$lib/styles/bonk.css';
	import { googleFontsHref, themeCss } from '$lib/theme';

	import { page } from '$app/state';

	let { children } = $props();

	// The merged data, not this layout's own: a status page overrides the site's theme and logo with its own.
	const appearance = $derived(page.data.appearance);
	const css = $derived(themeCss(appearance.theme));
	const fonts = $derived(googleFontsHref(appearance.theme));
</script>

<svelte:head>
	{#if fonts}
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link rel="stylesheet" href={fonts} />
	{/if}
	<link rel="icon" href={appearance.logo} />
	<!-- Values are validated in normalizeTheme (hex colors, [A-Za-z0-9 ] font names). -->
	{@html `<style id="bonk-theme">${css}</style>`}
</svelte:head>

{@render children()}
