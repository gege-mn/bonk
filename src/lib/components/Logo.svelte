<script lang="ts">
	let { size = 28, version = 0, onInk = false }: { size?: number; version?: number; onInk?: boolean } = $props();
</script>

<img
	src="/brand/logo?v={version}{onInk ? '&on=ink' : ''}"
	alt=""
	width={size}
	height={size}
	style="display:block;flex:none;object-fit:contain"
/>
