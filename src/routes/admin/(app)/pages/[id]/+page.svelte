<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const pg = $derived(data.pg);
	// A rejected save shows what was typed, not what's stored.
	const v = $derived(form?.values ?? { name: pg.name, slug: pg.slug, description: pg.description, links: data.links, public: pg.public });
	const linkRows = $derived(Array.from({ length: 5 }, (_, i) => v.links[i] ?? { label: '', href: '' }));
	let sure = $state(false);
</script>

<div class="layout">
	<form method="POST" action="?/save" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#if form?.saved}<div class="notice t-small">Saved.</div>{/if}
		{#if form?.madeDefault}<div class="notice t-small">This is now the default page, served at /.</div>{/if}
		{#if form?.error}<div class="notice notice-bad t-small">{form.error}</div>{/if}
		<fieldset class="stack">
			<legend class="legend">Page</legend>
			<label class="field">
				Name
				<input class="input" name="name" value={v.name} maxlength="60" required aria-invalid={form?.errors?.name ? 'true' : undefined} />
				{#if form?.errors?.name}<span class="error">{form.errors.name}</span>{/if}
			</label>
			<label class="field">
				Address
				<span class="slug">
					<span class="t-muted" aria-hidden="true">/</span>
					<input class="input" name="slug" value={v.slug} maxlength="40" required autocapitalize="off" spellcheck="false" aria-invalid={form?.errors?.slug ? 'true' : undefined} />
				</span>
				{#if form?.errors?.slug}<span class="error">{form.errors.slug}</span>{/if}
				<span class="help">
					{#if pg.is_default}
						The default page is served at <code>/</code>; <code>/{pg.slug}</code> redirects there and becomes its address if another page takes over.
					{:else}
						Lowercase letters, digits and dashes. Changing it breaks links to the old address.
					{/if}
				</span>
			</label>
			<label class="field">
				Description
				<textarea class="textarea" name="description" maxlength="300" placeholder="Optional. One line under the page's name.">{v.description}</textarea>
			</label>
		</fieldset>
		<fieldset class="stack-s">
			<legend class="legend">Header links</legend>
			{#each linkRows as l, i (i)}
				<div class="link">
					<input class="input" name="link_label" value={l.label} maxlength="40" placeholder="Label" aria-label="Link {i + 1} label" />
					<input class="input" name="link_href" value={l.href} maxlength="300" placeholder="https://… or mailto:…" aria-label="Link {i + 1} address" />
				</div>
			{/each}
			<span class="t-xs t-muted">Up to five, shown at the top of the page. A row needs both a label and an https:, http: or mailto: address, or it is dropped.</span>
		</fieldset>
		<fieldset class="stack-s">
			<legend class="legend">Visibility</legend>
			<label class="check"><input type="checkbox" name="public" checked={!!v.public} />Public: anyone with the address can see it</label>
			<span class="t-xs t-muted">
				Unticked, the page is private: it, its incidents and its status JSON ask for the admin sign-in.
				{#if data.auth === 'access'}You sign in with Cloudflare Access, so{:else}If you sign in with Cloudflare Access,{/if}
				{#if pg.is_default}the whole site{:else}<code>/{v.slug}</code>{/if} must also be added to the Access application, or a private page answers 403.
			</span>
		</fieldset>
		<div><button class="btn btn-primary">Save</button></div>
	</form>

	<aside class="stack">
		<div class="panel">
			<div class="panel-head"><h2 class="t-heading">Default page</h2></div>
			<div class="panel-body t-small stack-s">
				{#if pg.is_default}
					<p>This is the default page: visitors see it at <code>/</code>. To change that, open another page and make it the default.</p>
				{:else}
					<p>The default page is served at <code>/</code>. Making this one the default moves the current default to its own address.</p>
					<form method="POST" action="?/makeDefault" use:enhance><button class="btn btn-sm">Make this the default page</button></form>
				{/if}
			</div>
		</div>
		<div class="panel">
			<div class="panel-head"><h2 class="t-heading">Delete</h2></div>
			<div class="panel-body t-small stack-s">
				{#if pg.is_default}
					<p>The default page can't be deleted. Make another page the default first.</p>
				{:else}
					<p>Removes the page and its monitor list. The monitors themselves, their history and their alerts stay.</p>
					<form method="POST" action="?/delete" class="del" use:enhance>
						<label class="check t-small"><input type="checkbox" bind:checked={sure} />Delete this page</label>
						<button class="btn btn-danger btn-sm" disabled={!sure}>Delete</button>
					</form>
				{/if}
			</div>
		</div>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 640px) minmax(0, 420px);
		gap: 48px;
		align-items: start;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.slug {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	.link {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: 8px;
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
