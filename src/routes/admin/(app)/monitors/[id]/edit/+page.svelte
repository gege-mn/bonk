<script lang="ts">
	import MonitorForm from '$lib/components/MonitorForm.svelte';

	let { data, form } = $props();
</script>

<a href="/admin/monitors/{data.monitor.id}" class="back t-small">← {data.monitor.name}</a>
<h1 class="t-display t-display-l">Edit monitor</h1>
<MonitorForm
	monitor={data.monitor}
	selected={data.channelIds}
	channels={data.channels}
	selectedPages={data.pageIds}
	pages={data.pages}
	pushUrl={data.monitor.push_token ? `${data.origin}/api/push/${data.monitor.push_token}` : null}
	{form}
	cancelHref="/admin/monitors/{data.monitor.id}"
/>

<style>
	.back {
		align-self: flex-start;
	}
</style>
