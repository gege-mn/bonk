<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let name = $state('');
	let slug = $state('');
	// The address follows the name until someone types their own.
	let ownSlug = $state(false);

	$effect(() => {
		if (!form?.values) return;
		name = form.values.name;
		slug = form.values.slug;
		ownSlug = true;
	});

	const slugify = (s: string) =>
		s
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.replace(/-+$/, '');
</script>

<a href="/admin/pages" class="back t-small">← Status pages</a>
<h1 class="t-display t-display-l">New status page</h1>

<form method="POST" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<label class="field">
		Name
		<input
			class="input"
			name="name"
			maxlength="60"
			required
			bind:value={name}
			oninput={() => {
				if (!ownSlug) slug = slugify(name);
			}}
			aria-invalid={form?.errors?.name ? 'true' : undefined}
			placeholder="e.g. Internal tools"
		/>
		{#if form?.errors?.name}<span class="error">{form.errors.name}</span>{/if}
	</label>
	<label class="field">
		Address
		<span class="slug">
			<span class="t-muted" aria-hidden="true">/</span>
			<input
				class="input"
				name="slug"
				maxlength="40"
				required
				autocapitalize="off"
				spellcheck="false"
				bind:value={slug}
				oninput={() => (ownSlug = slug !== '')}
				aria-invalid={form?.errors?.slug ? 'true' : undefined}
				placeholder="internal-tools"
			/>
		</span>
		{#if form?.errors?.slug}<span class="error">{form.errors.slug}</span>{/if}
		<span class="help">Lowercase letters, digits and dashes. The page lives at <code>/{slug || 'your-slug'}</code>.</span>
	</label>
	<label class="field">
		Description
		<textarea class="textarea" name="description" maxlength="300" placeholder="Optional. One line under the page's name.">{form?.values?.description ?? ''}</textarea>
	</label>
	<div class="field">
		<label class="check"><input type="checkbox" name="public" checked={form?.values ? !!form.values.public : true} />Public: anyone with the address can see it</label>
		<span class="help">Unticked, the page is private and asks for the admin sign-in.</span>
	</div>
	<div class="actions">
		<button class="btn btn-primary">Create and pick monitors</button>
		<a class="btn btn-quiet" href="/admin/pages">Cancel</a>
	</div>
</form>

<style>
	.back {
		align-self: flex-start;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 640px;
	}
	.slug {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
</style>
