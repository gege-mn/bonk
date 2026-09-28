<script lang="ts">
	import { enhance } from '$app/forms';
	import ChannelForm from '$lib/components/ChannelForm.svelte';

	let { data, form } = $props();
	let sure = $state(false);
</script>

<a href="/admin/notifications" class="back t-small">← Notifications</a>
<h1 class="t-display t-display-l">{data.channel.name}</h1>

{#if data.created && !form}
	<div class="notice t-small">Saved. Send a test to make sure it arrives.</div>
{/if}
{#if form && 'saved' in form}<div class="notice t-small">Saved.</div>{/if}
{#if form && 'tested' in form}
	<div class="notice t-small" class:notice-bad={!form.testOk}>{form.testOk ? 'Test sent. Check the channel.' : `Test failed: ${form.testError}`}</div>
{/if}

<div class="panel wrap">
	<div class="panel-body">
		<ChannelForm
			providers={data.providers}
			fixed={data.channel.provider}
			values={data.values}
			name={data.channel.name}
			defaultOn={!!data.channel.default_on}
			errors={form && 'errors' in form ? (form.errors ?? {}) : {}}
			submitLabel="Save changes"
		/>
	</div>
</div>

<form method="POST" action="?/delete" class="del" use:enhance>
	<label class="check t-small"><input type="checkbox" bind:checked={sure} />Delete this channel (monitors stop alerting here)</label>
	<button class="btn btn-danger btn-sm" disabled={!sure}>Delete</button>
</form>

<style>
	.back {
		align-self: flex-start;
	}
	.wrap {
		max-width: 620px;
	}
	.del {
		display: flex;
		gap: 14px;
		align-items: center;
		flex-wrap: wrap;
	}
</style>
