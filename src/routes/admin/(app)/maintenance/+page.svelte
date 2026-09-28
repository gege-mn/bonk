<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtDate, fmtTime } from '$lib/format';

	let { data, form } = $props();
	const offset = $derived(typeof window === 'undefined' ? 0 : new Date().getTimezoneOffset());
	const names = (json: string) => {
		const ids = JSON.parse(json || '[]') as number[];
		return ids.length ? data.monitors.filter((m) => ids.includes(m.id)).map((m) => m.name).join(', ') : 'All monitors';
	};
</script>

<div class="layout">
	<section class="left">
		<div class="title">
			<h1 class="t-display t-display-l">Maintenance</h1>
			<p class="t-small t-muted">During a window, checks keep running but no alerts go out and no incidents open. The status page shows the window.</p>
		</div>
		<div class="rows">
			{#each data.windows as w (w.id)}
				<div class="win">
					<span class="tag s-{w.starts_at <= data.now && w.ends_at > data.now ? 'maintenance' : w.ends_at <= data.now ? 'none' : 'pending'}">
						{w.starts_at <= data.now && w.ends_at > data.now ? 'Now' : w.ends_at <= data.now ? 'Done' : 'Upcoming'}
					</span>
					<span class="body">
						<span class="t-heading">{w.title}</span>
						<span class="t-xs t-muted">{fmtDate(w.starts_at, false)} {fmtTime(w.starts_at)} → {fmtDate(w.ends_at, false)} {fmtTime(w.ends_at)} · {names(w.monitor_ids)}</span>
					</span>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={w.id} />
						<button class="btn btn-sm btn-quiet">Remove</button>
					</form>
				</div>
			{:else}
				<p class="empty">No maintenance scheduled.</p>
			{/each}
		</div>
	</section>

	<form method="POST" action="?/create" class="panel" use:enhance>
		<input type="hidden" name="tz_offset" value={offset} />
		<div class="panel-head"><h2 class="t-heading">Schedule a window</h2></div>
		<div class="panel-body stack">
			{#if form?.error}<p class="t-small bad">{form.error}</p>{/if}
			<label class="field">Title<input class="input" name="title" required placeholder="e.g. Database upgrade" /></label>
			<div class="two">
				<label class="field">Starts<input class="input" type="datetime-local" name="starts_at" required /></label>
				<label class="field">Ends<input class="input" type="datetime-local" name="ends_at" required /></label>
			</div>
			<span class="t-xs t-muted">In your browser's time zone.</span>
			<label class="field">Note for visitors<textarea class="textarea" name="body" placeholder="Optional"></textarea></label>
			<fieldset class="stack-s">
				<legend class="field">Affects (none selected = all)</legend>
				{#each data.monitors as m (m.id)}
					<label class="check"><input type="checkbox" name="monitors" value={m.id} />{m.name}</label>
				{/each}
			</fieldset>
			<button class="btn btn-primary">Schedule</button>
		</div>
	</form>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 440px;
		gap: 48px;
		align-items: start;
	}
	.left {
		display: flex;
		flex-direction: column;
		gap: 24px;
		min-width: 0;
	}
	.title {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 640px;
	}
	.win {
		display: grid;
		grid-template-columns: 100px minmax(0, 1fr) auto;
		gap: 16px;
		align-items: center;
		padding: 12px 0;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.panel h2 {
		font-size: 18px;
	}
	.bad {
		color: var(--bonk-down);
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
