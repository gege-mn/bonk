<script lang="ts">
	import MonitorForm from '$lib/components/MonitorForm.svelte';

	let { data, form } = $props();
</script>

<a href="/admin" class="back t-small">← Monitors</a>
<h1 class="t-display t-display-l">New monitor</h1>
<MonitorForm channels={data.channels} pages={data.pages} {form} cancelHref="/admin" />

<style>
	.back {
		align-self: flex-start;
	}
</style>
