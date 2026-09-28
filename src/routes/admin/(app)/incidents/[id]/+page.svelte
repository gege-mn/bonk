<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtDate, fmtTime } from '$lib/format';

	let { data, form } = $props();
	const i = $derived(data.incident);
	let sure = $state(false);
</script>

<a href="/admin/incidents" class="back t-small">← Incidents</a>
<div class="head">
	<span class="tag s-{i.resolved_at ? 'up' : i.severity === 'info' ? 'maintenance' : i.severity}">{i.resolved_at ? 'Resolved' : i.status}</span>
	<h1 class="t-display t-display-l">{i.title}</h1>
	<span class="t-small t-muted">Started {fmtDate(i.started_at)} {fmtTime(i.started_at)}{i.public ? '' : ' · hidden from the status page'}</span>
</div>
{#if form?.error}<div class="notice notice-bad t-small">{form.error}</div>{/if}

<div class="layout">
	<section>
		<h2 class="t-heading sub">Timeline</h2>
		<ol class="rows timeline">
			{#each data.updates as u (u.id)}
				<li>
					<span class="t-muted t-small">{fmtDate(u.ts, false)} {fmtTime(u.ts)}</span>
					<span><strong class="cap">{u.status}.</strong> {u.body}</span>
				</li>
			{/each}
		</ol>
	</section>
	<div class="side">
		<form method="POST" action="?/update" class="panel" use:enhance>
			<div class="panel-head"><h2 class="t-heading">Post an update</h2></div>
			<div class="panel-body stack">
				<div class="segmented segmented-sm">
					{#each ['investigating', 'identified', 'monitoring', 'resolved'] as s (s)}
						<label><input type="radio" name="status" value={s} checked={(i.resolved_at ? 'resolved' : i.status) === s} /><span class="cap">{s}</span></label>
					{/each}
				</div>
				<label class="field">Message<textarea class="textarea" name="body" required></textarea></label>
				<button class="btn btn-primary">Post update</button>
			</div>
		</form>
		<form method="POST" action="?/edit" class="panel" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<div class="panel-body stack">
				<label class="field">Title<input class="input" name="title" value={i.title} maxlength="140" /></label>
				<label class="check"><input type="checkbox" name="public" checked={!!i.public} />Show on the status page</label>
				<button class="btn">Save</button>
			</div>
		</form>
		<form method="POST" action="?/delete" class="del" use:enhance>
			<label class="check t-small"><input type="checkbox" bind:checked={sure} />Delete this incident</label>
			<button class="btn btn-danger btn-sm" disabled={!sure}>Delete</button>
		</form>
	</div>
</div>

<style>
	.back {
		align-self: flex-start;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 420px;
		gap: 48px;
		align-items: start;
	}
	.sub {
		font-size: 16px;
		margin-bottom: 12px;
	}
	.timeline {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.timeline li {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: 16px;
		padding: 14px 0;
	}
	.cap {
		text-transform: capitalize;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.panel h2 {
		font-size: 16px;
	}
	.del {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
