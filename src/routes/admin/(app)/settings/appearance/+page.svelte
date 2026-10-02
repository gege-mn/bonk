<script lang="ts">
	import ThemeEditor from '$lib/components/ThemeEditor.svelte';

	let { data, form } = $props();
</script>

<p class="t-small t-muted">This theme and logo are used by the admin and by any status page that hasn't set its own.</p>

<ThemeEditor saved={data.appearance.theme} logoUrl={data.appearance.logo} name={data.appearance.site.name} {form} />
