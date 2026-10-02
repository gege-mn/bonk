<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { COLOR_TOKENS, contrastChecks, FONT_CHOICES, googleFontsHref, PRESETS, themeCss, type Mode, type Theme } from '$lib/theme';

	interface Result {
		saved?: string;
		error?: string;
		logoError?: string;
	}
	interface Props {
		/** The published theme. For a page that follows the site, the site theme. */
		saved: Theme;
		/** Logo image URL with its cache-busting ?v=; the preview appends &color=. */
		logoUrl: string;
		/** Name shown next to the logo in the preview. */
		name: string;
		form: Result | null | undefined;
		actions?: { theme: string; reset: string; logo: string; removeLogo: string };
		/** Status pages only: what the page still takes from the site. Leave out on the site screen. */
		inherits?: { theme: boolean; logo: boolean };
	}
	let {
		saved,
		logoUrl,
		name,
		form,
		actions = { theme: '?/theme', reset: '?/reset', logo: '?/logo', removeLogo: '?/removeLogo' },
		inherits
	}: Props = $props();

	const clone = (t: Theme): Theme => JSON.parse(JSON.stringify(t));
	let theme = $state<Theme>(clone(untrack(() => saved)));
	let editing = $state<'light' | 'dark'>(untrack(() => (theme.mode === 'dark' ? 'dark' : 'light')));
	let saving = $state(false);

	const palette = $derived(theme[editing]);
	const checks = $derived(contrastChecks(palette));
	const previewCss = $derived(themeCss({ ...theme, mode: editing }, '.pv'));
	const previewFonts = $derived(googleFontsHref(theme));
	const dirty = $derived(JSON.stringify(theme) !== JSON.stringify(saved));
	// Publishing an untouched site theme is still a change for a page: it stops following the site.
	const canPublish = $derived(dirty || !!inherits?.theme);
	const notice = $derived(
		!form?.saved
			? ''
			: form.saved === 'logo'
				? inherits?.logo
					? 'Using the site logo.'
					: 'Logo updated.'
				: form.saved === 'reset'
					? inherits
						? 'This page follows the site theme again.'
						: 'Back to the default theme and logo.'
					: 'Theme published.'
	);

	function applyPreset(id: string) {
		theme = clone(PRESETS[id].theme);
		editing = theme.mode === 'dark' ? 'dark' : 'light';
	}
	function setMode(m: Mode) {
		theme.mode = m;
		if (m !== 'system') editing = m;
	}
	const HEX = /^#[0-9a-f]{6}$/i;

	const bars = Array.from({ length: 50 }, (_, i) => (i === 17 || i === 41 ? 'degraded' : i === 29 ? 'down' : 'up'));
</script>

<svelte:head>
	{#if previewFonts}<link rel="stylesheet" href={previewFonts} />{/if}
	{@html `<style>${previewCss}</style>`}
</svelte:head>

{#if notice}<div class="notice t-small">{notice}</div>{/if}
{#if form?.error}<div class="notice t-small bad">{form.error}</div>{/if}

<div class="layout">
	<div class="controls">
		{#if inherits?.theme}
			<p class="follows t-small">This page follows the site theme, shown here. Publish to give the page its own; later changes to the site theme will then no longer reach it.</p>
		{/if}
		<fieldset>
			<legend class="legend">Start from a preset</legend>
			<div class="presets">
				{#each Object.entries(PRESETS) as [id, p] (id)}
					{@const pal = p.theme.mode === 'dark' ? p.theme.dark : p.theme.light}
					<button type="button" class="preset" class:on={theme.preset === id} aria-pressed={theme.preset === id} onclick={() => applyPreset(id)}>
						<span class="chips"><i style="background:{pal.bg}"></i><i style="background:{pal.ink}"></i><i style="background:{pal.accent}"></i></span>
						<span class="t-heading">{p.name}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset class="brand">
			<legend class="legend">Logo</legend>
			<span class="logo-box"><img src={logoUrl} alt="Current logo" width="52" height="52" /></span>
			<div class="stack-s">
				<form method="POST" action={actions.logo} enctype="multipart/form-data" class="row" use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}>
					<label class="btn btn-sm file">Choose file<input type="file" name="logo" accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp" onchange={(e) => e.currentTarget.form?.requestSubmit()} /></label>
					<button type="submit" formaction={actions.removeLogo} class="btn btn-sm btn-quiet" disabled={inherits?.logo}>{inherits ? 'Use the site logo' : 'Use default'}</button>
				</form>
				{#if form?.logoError}<span class="t-xs bad">{form.logoError}</span>{/if}
				{#if inherits?.logo}<span class="t-xs t-muted">This page uses the site logo, drawn in the page's colors. Upload one to give it its own.</span>{/if}
				<span class="t-xs t-muted">SVG, PNG or WebP up to 64 KB, stored in D1. SVGs drawn with <code>currentColor</code> follow the text color.</span>
			</div>
		</fieldset>

		<fieldset>
			<legend class="legend">Mode</legend>
			<div class="segmented segmented-sm">
				{#each [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow the visitor']] as [m, label] (m)}
					<button type="button" aria-pressed={theme.mode === m} onclick={() => setMode(m as Mode)}>{label}</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="legend row-between">
				<span>Colors</span>
				{#if theme.mode === 'system'}
					<span class="segmented segmented-sm small">
						<button type="button" aria-pressed={editing === 'light'} onclick={() => (editing = 'light')}>Light</button>
						<button type="button" aria-pressed={editing === 'dark'} onclick={() => (editing = 'dark')}>Dark</button>
					</span>
				{/if}
			</legend>
			{#each COLOR_TOKENS as t (t.key)}
				<div class="color">
					<input type="color" value={palette[t.key]} oninput={(e) => (theme[editing][t.key] = e.currentTarget.value)} aria-label="{t.label} color" />
					<span class="c-label">
						<span class="t-small strong">{t.label}</span>
						<span class="t-xs t-muted">{t.help}</span>
					</span>
					<input
						class="input hex"
						value={palette[t.key]}
						aria-label="{t.label} hex"
						onchange={(e) => {
							const v = e.currentTarget.value.trim();
							if (HEX.test(v)) theme[editing][t.key] = v.toLowerCase();
							else e.currentTarget.value = palette[t.key];
						}}
					/>
				</div>
			{/each}
		</fieldset>

		<fieldset class="grid3">
			<legend class="legend">Type &amp; shape</legend>
			<label class="field">Display<select class="select" bind:value={theme.fonts.display}>{#each FONT_CHOICES as f (f)}<option>{f}</option>{/each}</select></label>
			<label class="field">Headings<select class="select" bind:value={theme.fonts.heading}>{#each FONT_CHOICES as f (f)}<option>{f}</option>{/each}</select></label>
			<label class="field">Body<select class="select" bind:value={theme.fonts.body}>{#each FONT_CHOICES as f (f)}<option>{f}</option>{/each}</select></label>
			<label class="field">
				Corners
				<select class="select" bind:value={theme.radius}>
					<option value="square">Square</option>
					<option value="soft">Soft</option>
					<option value="round">Round</option>
				</select>
			</label>
		</fieldset>
		<p class="t-xs t-muted">Fonts other than the System ones load from Google Fonts.</p>
	</div>

	<aside class="side">
		<div class="side-head">
			<span class="t-label">Live preview — {editing}</span>
		</div>
		<div class="pv">
			<div class="pv-page">
				<div class="pv-brand">
					<img src="{logoUrl}&color={palette.ink.slice(1)}" alt="" width="24" height="24" />
					<span class="pv-heading pv-name">{name}</span>
					<span class="pv-muted pv-s">/ status</span>
				</div>
				<span class="pv-display">All systems operational</span>
				<div>
					{#each ['API', 'Dashboard', 'Webhooks'] as n, j (n)}
						<div class="pv-row">
							<span class="pv-heading">{n}</span>
							<div class="pv-bars">{#each bars as b, i (i)}<i style="background:var(--bonk-{j === 1 && b !== 'up' ? b : j === 2 && i > 44 ? 'nodata' : 'up'})"></i>{/each}</div>
							<span class="pv-s strong">{j === 1 ? '99.81%' : '100%'}</span>
						</div>
					{/each}
				</div>
				<div class="pv-actions">
					<span class="pv-btn">Primary button</span>
					<span class="pv-tag">Degraded</span>
					<a href="#preview" class="pv-s" onclick={(e) => e.preventDefault()}>A link</a>
				</div>
			</div>
		</div>

		<div class="checks">
			<span class="t-label">Contrast</span>
			{#each checks as c (c.label)}
				<div class="chk t-xs" class:fail={c.ratio < c.min}>
					<span>{c.label}</span>
					<span class="t-num">{c.ratio.toFixed(1)}:1 {c.ratio >= c.min ? '✓' : `needs ${c.min}`}</span>
				</div>
			{/each}
		</div>

		<form
			method="POST"
			action={actions.theme}
			class="save"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					theme = clone(saved);
					editing = theme.mode === 'dark' ? 'dark' : 'light';
					saving = false;
				};
			}}
		>
			<input type="hidden" name="theme" value={JSON.stringify(theme)} />
			<button type="submit" formaction={actions.reset} class="btn btn-quiet" formnovalidate disabled={inherits?.theme}>{inherits ? 'Use the site theme' : 'Reset to default'}</button>
			<button class="btn btn-primary" disabled={!canPublish || saving}>{saving ? 'Publishing…' : canPublish ? 'Publish theme' : 'Published'}</button>
		</form>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 560px) minmax(0, 1fr);
		gap: 48px;
		align-items: start;
	}
	.controls {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}
	.follows {
		margin: 0;
		padding: 10px 12px;
		border: 1px solid var(--bonk-line);
		border-left: 3px solid var(--bonk-accent);
		border-radius: var(--bonk-radius-sm);
		background: var(--bonk-surface);
	}
	.presets {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.preset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		border: 1px solid var(--bonk-line);
		border-radius: var(--bonk-radius-sm);
		background: var(--bonk-surface);
		color: var(--bonk-ink);
		text-align: left;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.preset.on {
		border: 2px solid var(--bonk-accent);
		padding: 9px;
	}
	.chips {
		display: flex;
		height: 28px;
	}
	.chips i {
		flex: 1;
	}
	.chips i:first-child {
		flex: 2;
		box-shadow: inset 0 0 0 1px var(--bonk-line);
	}
	.brand {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 18px;
		align-items: center;
	}
	.logo-box {
		width: 88px;
		height: 88px;
		display: grid;
		place-items: center;
		border: 1px dashed var(--bonk-muted);
		border-radius: var(--bonk-radius-sm);
		background: var(--bonk-surface);
	}
	.logo-box img {
		object-fit: contain;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.file {
		position: relative;
		cursor: pointer;
	}
	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.stack-s {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row-between {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}
	.small {
		font-family: var(--bonk-font-body);
		font-weight: 400;
	}
	.color {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 110px;
		gap: 14px;
		align-items: center;
		padding: 8px 0;
		border-top: 1px solid var(--bonk-line);
	}
	.color input[type='color'] {
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--bonk-line);
		border-radius: var(--bonk-radius-sm);
		background: none;
		cursor: pointer;
	}
	.c-label {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.hex {
		min-height: 36px;
		font-size: 13px;
	}
	.strong {
		font-weight: 700;
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	.side {
		position: sticky;
		top: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.pv {
		border: 1.5px solid var(--bonk-ink);
		border-radius: var(--bonk-radius-md);
		overflow: hidden;
	}
	.pv-page {
		background: var(--bonk-bg);
		color: var(--bonk-ink);
		font-family: var(--bonk-font-body);
		padding: 28px 32px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.pv-brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pv-heading {
		font-family: var(--bonk-font-heading);
		font-weight: 700;
		font-size: 14px;
	}
	.pv-name {
		font-size: 18px;
	}
	.pv-muted {
		color: var(--bonk-muted);
	}
	.pv-s {
		font-size: 12px;
	}
	.pv-display {
		font-family: var(--bonk-font-display);
		font-weight: 600;
		font-size: 48px;
		line-height: 0.95;
		text-transform: uppercase;
	}
	.pv-row {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) 60px;
		gap: 16px;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--bonk-line);
	}
	.pv-row .strong {
		text-align: right;
	}
	.pv-bars {
		display: flex;
		gap: 2px;
		height: 22px;
	}
	.pv-bars i {
		flex: 1;
		border-radius: calc(var(--bonk-radius-sm) / 2);
	}
	.pv-actions {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.pv-btn {
		padding: 10px 16px;
		background: var(--bonk-accent);
		color: var(--bonk-accent-ink);
		border-radius: var(--bonk-radius-sm);
		font-family: var(--bonk-font-heading);
		font-weight: 700;
		font-size: 13px;
	}
	.pv-tag {
		padding: 3px 8px;
		background: var(--bonk-degraded);
		color: var(--bonk-on-degraded);
		border-radius: var(--bonk-radius-sm);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.pv a {
		color: var(--bonk-accent);
	}
	.checks {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.chk {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		border-top: 1px solid var(--bonk-line);
	}
	.chk.fail {
		color: var(--bonk-down);
		font-weight: 700;
	}
	.save {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.bad {
		color: var(--bonk-down);
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			position: static;
		}
	}
</style>
