<script lang="ts">
	import StatusPage from '$lib/components/StatusPage.svelte';

	let { data } = $props();
</script>

<StatusPage appearance={data.appearance} page={data.statusPage} status={data.status} />
