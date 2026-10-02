<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Sign in · {data.appearance.site.name}</title></svelte:head>

<main class="wrap">
	<form method="POST" class="panel card">
		<div class="brand">
			<Logo size={28} src={data.appearance.logo} />
			<span class="t-heading">{data.appearance.site.name}</span>
			<span class="t-small t-muted">/ uptime</span>
		</div>
		<h1 class="t-display t-display-l">Sign in</h1>
		<label class="field">
			Admin password
			<!-- svelte-ignore a11y_autofocus -->
			<input class="input" type="password" name="password" autocomplete="current-password" required autofocus aria-invalid={form?.error ? 'true' : undefined} />
			{#if form?.error}<span class="error">{form.error}</span>{/if}
		</label>
		<button class="btn btn-primary">Sign in</button>
		<p class="t-xs t-muted">The password is the <code>ADMIN_PASSWORD</code> secret on this Worker.</p>
	</form>
</main>

<style>
	.wrap {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.card {
		width: min(420px, 100%);
		padding: 32px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 19px;
	}
</style>
