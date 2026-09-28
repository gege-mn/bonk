<script lang="ts">
	import '$lib/styles/bonk.css';
	import { googleFontsHref, themeCss } from '$lib/theme';

	let { data, children } = $props();

	const css = $derived(themeCss(data.appearance.theme));
	const fonts = $derived(googleFontsHref(data.appearance.theme));
</script>

<svelte:head>
	{#if fonts}
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link rel="stylesheet" href={fonts} />
	{/if}
	<link rel="icon" href="/brand/logo?v={data.appearance.logoVersion}" />
	<!-- Values are validated in normalizeTheme (hex colors, [A-Za-z0-9 ] font names). -->
	{@html `<style id="bonk-theme">${css}</style>`}
</svelte:head>

{@render children()}
