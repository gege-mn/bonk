<script lang="ts">
	import { fmtDate, fmtDuration, fmtTime } from '$lib/format';

	let { data, form } = $props();
	const minSeconds = $derived(data.appearance.rules.minIncidentMin * 60);
	let monitorId = $state('');
</script>

<div class="layout">
	<section class="left">
		<div class="title">
			<h1 class="t-display t-display-l">Incidents</h1>
			<p class="t-small t-muted">Opened automatically when a monitor goes down, closed when it recovers. Add updates so visitors know what's happening.</p>
		</div>
		<div class="rows">
			{#each data.incidents as i (i.id)}
				<a class="inc" href="/admin/incidents/{i.id}">
					<span class="tag s-{i.resolved_at ? 'up' : i.severity === 'info' ? 'maintenance' : i.severity}">{i.resolved_at ? 'Resolved' : i.status}</span>
					<span class="body">
						<span class="t-heading">{i.title}</span>
						<span class="t-xs t-muted">
							{fmtDate(i.started_at)} {fmtTime(i.started_at)}
							{#if i.resolved_at}· {fmtDuration(i.resolved_at - i.started_at)}{/if}
							{#if i.monitor_name}· {i.monitor_name}{/if}
							{#if i.auto}· automatic{/if}
							{#if !i.public}
								· hidden from status pages
							{:else if !i.page_count}
								· on no status page
							{:else if i.auto && i.resolved_at && i.resolved_at - i.started_at < minSeconds}
								· too short for the status page
							{/if}
						</span>
					</span>
				</a>
			{:else}
				<p class="empty">No incidents. Quiet is good.</p>
			{/each}
		</div>
	</section>

	<form method="POST" action="?/create" class="panel new">
		<div class="panel-head"><h2 class="t-heading">Post an incident</h2></div>
		<div class="panel-body stack">
			{#if form?.error}<p class="t-small bad">{form.error}</p>{/if}
			<label class="field">Title<input class="input" name="title" maxlength="140" placeholder="e.g. Payments are delayed" required /></label>
			<label class="field">
				Severity
				<select class="select" name="severity">
					<option value="info">Notice</option>
					<option value="degraded">Degraded</option>
					<option value="down">Outage</option>
				</select>
			</label>
			<label class="field">
				Affects
				<select class="select" name="monitor_id" bind:value={monitorId}>
					<option value="">No specific monitor</option>
					{#each data.monitors as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
				</select>
			</label>
			<label class="field">First update<textarea class="textarea" name="body" required placeholder="What's happening and what you're doing about it."></textarea></label>
			{#if monitorId}
				<p class="t-xs t-muted">It appears on every status page that lists this monitor.</p>
			{:else}
				<fieldset class="pages">
					<legend>Post on</legend>
					{#each data.pages as p (p.id)}
						<label class="check check-box">
							<input type="checkbox" name="pages" value={p.id} checked={!!p.is_default} />
							{p.name}<span class="t-muted t-small">· {p.public ? 'public' : 'private'}</span>
						</label>
					{/each}
				</fieldset>
			{/if}
			<label class="check"><input type="checkbox" name="public" checked />Show on status pages</label>
			<button class="btn btn-primary">Post incident</button>
		</div>
	</form>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 420px;
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
	.inc {
		display: grid;
		grid-template-columns: 130px minmax(0, 1fr);
		gap: 16px;
		align-items: center;
		padding: 14px 0;
		color: var(--bonk-ink);
		text-decoration: none;
	}
	.inc .tag {
		justify-self: start;
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
	.pages {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.pages legend {
		padding: 0;
		margin-bottom: 6px;
		font-size: 13px;
		font-weight: 700;
	}
	.new h2 {
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
