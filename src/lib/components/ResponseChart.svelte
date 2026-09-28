<script lang="ts">
	import { fmtMs } from '$lib/format';

	let {
		points,
		threshold = null,
		from,
		to,
		labels
	}: { points: { ts: number; v: number | null }[]; threshold?: number | null; from: number; to: number; labels: string[] } = $props();

	const W = 1000;
	const H = 200;

	/** Top of the axis: four steps of a round size (50, 100, 250, 500 ms, …). */
	function niceMax(n: number) {
		const step = Math.max(n, 100) / 4;
		const p = 10 ** Math.floor(Math.log10(step));
		const f = step / p;
		return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p * 4;
	}

	const vals = $derived(points.filter((p) => p.v !== null) as { ts: number; v: number }[]);
	const max = $derived(niceMax(Math.max(threshold ?? 0, ...vals.map((p) => p.v)) * 1.05));
	const x = (ts: number) => ((ts - from) / Math.max(1, to - from)) * W;
	const y = (v: number) => H - (v / max) * H;

	// Gaps (no data) break the line instead of drawing a false slope across them.
	const segments = $derived.by(() => {
		const segs: { ts: number; v: number }[][] = [];
		let cur: { ts: number; v: number }[] = [];
		for (const p of points) {
			if (p.v === null) {
				if (cur.length) segs.push(cur);
				cur = [];
			} else cur.push(p as { ts: number; v: number });
		}
		if (cur.length) segs.push(cur);
		return segs;
	});
	const line = $derived(
		segments.map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts).toFixed(1)} ${y(p.v).toFixed(1)}`).join('')).join('')
	);
	const area = $derived(
		segments
			.filter((seg) => seg.length > 1)
			.map(
				(seg) =>
					`M${x(seg[0].ts).toFixed(1)} ${H}` +
					seg.map((p) => `L${x(p.ts).toFixed(1)} ${y(p.v).toFixed(1)}`).join('') +
					`L${x(seg[seg.length - 1].ts).toFixed(1)} ${H}Z`
			)
			.join('')
	);
	const ticks = $derived([1, 0.75, 0.5, 0.25, 0].map((f) => max * f));
</script>

<div class="chart">
	<div class="y t-xs t-muted">
		{#each ticks as t (t)}<span>{t >= 1000 ? `${+(t / 1000).toFixed(2)} s` : `${Math.round(t)} ms`}</span>{/each}
	</div>
	{#if vals.length}
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Response time; latest {fmtMs(vals[vals.length - 1]?.v)}">
			<path d="M0 50H{W}M0 100H{W}M0 150H{W}" class="grid" />
			{#if threshold}<path d="M0 {y(threshold)}H{W}" class="thr" />{/if}
			<path d={area} class="area" />
			<path d={line} class="line" />
		</svg>
	{:else}
		<div class="nodata t-small t-muted">No response times in this range yet.</div>
	{/if}
	<span></span>
	<div class="x t-xs t-muted">{#each labels as l, i (i)}<span>{l}</span>{/each}</div>
</div>

<style>
	.chart {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr);
		gap: 8px;
	}
	.y {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		text-align: right;
		height: 200px;
	}
	svg,
	.nodata {
		width: 100%;
		height: 200px;
		display: block;
		background: var(--bonk-surface);
		border-radius: var(--bonk-radius-sm);
	}
	.nodata {
		display: grid;
		place-items: center;
	}
	.grid {
		stroke: var(--bonk-line);
		stroke-width: 1;
		fill: none;
		vector-effect: non-scaling-stroke;
	}
	.thr {
		stroke: var(--bonk-degraded);
		stroke-width: 1.5;
		stroke-dasharray: 6 6;
		fill: none;
		vector-effect: non-scaling-stroke;
	}
	.area {
		fill: var(--bonk-accent);
		fill-opacity: 0.08;
	}
	.line {
		fill: none;
		stroke: var(--bonk-accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
	}
	.x {
		display: flex;
		justify-content: space-between;
	}
</style>
