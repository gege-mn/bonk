<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import PageMonitorPicker from '$lib/components/PageMonitorPicker.svelte';

	let { data, form } = $props();
	let dirty = $state(false);
	let valid = $state(true);
	let saving = $state(false);

	// The picker only keeps its edits in memory, and the tabs above are one click away.
	beforeNavigate((nav) => {
		if (dirty && !saving && !nav.willUnload && !confirm('Leave without saving the changes to this page’s monitors?')) nav.cancel();
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (dirty && !saving) e.preventDefault();
	}}
/>

{#if data.monitors.length === 0}
	<div class="none">
		<p class="empty">There are no monitors yet, so there is nothing to put on this page.</p>
		<a class="btn btn-primary" href="/admin/monitors/new">Add a monitor</a>
	</div>
{:else}
	<form
		method="POST"
		action="?/save"
		class="stack"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		{#if form?.error}<div class="notice notice-bad t-small" role="alert">{form.error}</div>{/if}
		{#if form?.saved && !dirty}<div class="notice t-small" role="status">Saved.</div>{/if}
		<!-- Keyed on the page so moving between pages starts from that page's list, not this one's edits. -->
		{#key data.pg.id}
			<PageMonitorPicker rows={data.rows} monitors={data.monitors} bind:dirty bind:valid />
		{/key}
		<div class="save">
			<button class="btn btn-primary" disabled={!dirty || !valid || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
			{#if dirty}<span class="t-small t-muted" role="status">{valid ? 'Unsaved changes.' : 'Fix the group names to save.'}</span>{/if}
		</div>
	</form>
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.none {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		padding-bottom: 40px;
	}
	.save {
		display: flex;
		align-items: center;
		gap: 14px;
		/* Stays reachable under a long list. */
		position: sticky;
		bottom: 0;
		padding: 12px 0;
		background: var(--bonk-bg);
		border-top: 1px solid var(--bonk-line);
	}
</style>
