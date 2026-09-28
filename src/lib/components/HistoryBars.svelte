<script lang="ts">
	import { fmtDate } from '$lib/format';

	type Bar = { day: number; n: number; deg: number; down: number; status: string };
	let { bars, size = 'm', label = 'Daily history' }: { bars: Bar[]; size?: 's' | 'm' | 'l'; label?: string } = $props();

	function tip(b: Bar): string {
		if (!b.n) return `${fmtDate(b.day)}\nNo data`;
		const up = ((b.n - b.down) / b.n) * 100;
		const pct = up >= 99.995 ? '100%' : `${(Math.floor(up * 100) / 100).toFixed(2)}%`;
		const extra = [b.down ? `${b.down} failed` : '', b.deg ? `${b.deg} slow` : ''].filter(Boolean).join(', ');
		return `${fmtDate(b.day)}\n${pct} up${extra ? ` · ${extra}` : ''}`;
	}
</script>

<div class="bars" class:bars-s={size === 's'} class:bars-l={size === 'l'} role="img" aria-label={label}>
	{#each bars as b (b.day)}
		<span class="s-{b.status}" data-tip={tip(b)}></span>
	{/each}
</div>
