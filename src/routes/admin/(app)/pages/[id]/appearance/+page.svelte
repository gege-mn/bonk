<script lang="ts">
	import ThemeEditor from '$lib/components/ThemeEditor.svelte';

	let { data, form } = $props();
</script>

<!-- Keyed so switching pages doesn't carry one page's unsaved edits into another. -->
{#key data.pg.id}
	<ThemeEditor
		saved={data.theme}
		logoUrl={data.logoUrl}
		name={data.pg.name}
		{form}
		inherits={{ theme: !data.pg.theme, logo: !data.pg.has_logo }}
	/>
{/key}
