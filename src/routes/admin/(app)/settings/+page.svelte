<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const site = $derived(data.appearance.site);
	const links = $derived([...site.links, { label: '', href: '' }, { label: '', href: '' }].slice(0, 5));
</script>

<div class="layout">
	<form method="POST" action="?/site" class="stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#if form?.saved}<div class="notice t-small">Saved.</div>{/if}
		{#if form?.error}<div class="notice notice-bad t-small">{form.error}</div>{/if}
		<fieldset class="stack">
			<legend class="legend">Status page</legend>
			<label class="field">Name<input class="input" name="name" value={site.name} maxlength="60" required /><span class="help">Shown next to the logo, in the tab title and in alerts.</span></label>
			<label class="field">Description<input class="input" name="description" value={site.description} maxlength="300" /><span class="help">Shown under the headline when everything is fine.</span></label>
			<label class="field">
				Public URL
				<input class="input" name="url" value={site.url} placeholder={data.origin} />
				<span class="help">Used to link alerts back to the admin. Usually {data.origin}.</span>
			</label>
		</fieldset>
		<fieldset class="stack">
			<legend class="legend">Short blips</legend>
			<label class="field">
				Ignore trouble shorter than (minutes)
				<input class="input narrow" type="number" name="min_incident_min" min="0" max="1440" value={data.appearance.rules.minIncidentMin} />
				<span class="help">
					Automatic incidents that recover sooner stay off the status page, and a day only changes color once its failed
					checks add up to this long. They still alert you and stay in the admin. 0 shows everything.
				</span>
			</label>
		</fieldset>
		<fieldset class="stack">
			<legend class="legend">Header links</legend>
			{#each links as l, i (i)}
				<div class="link">
					<input class="input" name="link_label" value={l.label} placeholder="Label" aria-label="Link {i + 1} label" />
					<input class="input" name="link_href" value={l.href} placeholder="https://" aria-label="Link {i + 1} URL" />
				</div>
			{/each}
		</fieldset>
		<div><button class="btn btn-primary">Save</button></div>
	</form>

	<aside class="stack">
		<div class="panel">
			<div class="panel-head"><h2 class="t-heading">Sign-in</h2></div>
			<div class="panel-body t-small stack-s">
				{#if data.auth === 'access'}
					<p><strong>Cloudflare Access.</strong> Verified against <code>{data.teamDomain}</code> with <code>CF_AUD_TOKEN</code>.{#if data.hasPassword} ADMIN_PASSWORD is set but ignored.{/if}</p>
				{:else}
					<p><strong>Password</strong> (<code>ADMIN_PASSWORD</code>). For single sign-on, put <code>/admin</code> behind Cloudflare Access and set <code>CF_TEAM_DOMAIN</code> and <code>CF_AUD_TOKEN</code>.</p>
				{/if}
			</div>
		</div>
		<div class="panel">
			<div class="panel-head"><h2 class="t-heading">Credentials at rest</h2></div>
			<div class="panel-body t-small">
				{#if data.hasKey}
					<p>Notification tokens and webhook URLs are encrypted with <code>ENCRYPTION_KEY</code> (AES-GCM). Changing the key makes saved channels unreadable.</p>
				{:else}
					<p class="bad"><strong>ENCRYPTION_KEY is not set</strong>, so notification credentials are stored in plain text in D1.</p>
				{/if}
			</div>
		</div>
		<div class="panel">
			<div class="panel-head"><h2 class="t-heading">Status JSON</h2></div>
			<div class="panel-body t-small"><p>Machine-readable status for widgets: <a href="/api/status.json">{data.origin}/api/status.json</a></p></div>
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
	.link {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		gap: 10px;
	}
	.narrow {
		max-width: 120px;
	}
	.panel h2 {
		font-size: 16px;
	}
	.bad {
		color: var(--bonk-down);
	}
	code {
		word-break: break-all;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
