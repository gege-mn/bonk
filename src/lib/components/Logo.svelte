<script lang="ts">
	/** `src` is `appearance.logo`: the site's logo or a status page's, with its version in the query. */
	let { size = 28, src, onInk = false }: { size?: number; src: string; onInk?: boolean } = $props();
</script>

<img
	src="{src}{onInk ? '&on=ink' : ''}"
	alt=""
	width={size}
	height={size}
	style="display:block;flex:none;object-fit:contain"
/>
