<script lang="ts">
	import StatusPage from '$lib/components/StatusPage.svelte';

	let { data } = $props();
</script>

<StatusPage appearance={data.appearance} status={data.status} gated />
