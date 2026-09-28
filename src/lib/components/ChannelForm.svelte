<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';

	type Field = {
		key: string;
		label: string;
		type: string;
		required?: boolean;
		secret?: boolean;
		placeholder?: string;
		help?: string;
		options?: { value: string; label: string }[];
		default?: string | boolean;
	};
	type Meta = { id: string; name: string; mono: string; category: string; docs: string | null; fields: Field[] };

	let {
		providers,
		fixed = null,
		values = {},
		name = '',
		defaultOn = true,
		errors = {},
		submitLabel,
		showApplyAll = false
	}: {
		providers: Meta[];
		fixed?: string | null;
		values?: Record<string, string | boolean>;
		name?: string;
		defaultOn?: boolean;
		errors?: Record<string, string>;
		submitLabel: string;
		showApplyAll?: boolean;
	} = $props();

	let picked = $state(untrack(() => fixed) ?? 'telegram');
	let q = $state('');
	let busy = $state(false);
	const p = $derived(providers.find((x) => x.id === picked)!);
	const shown = $derived(
		providers.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()) || x.category.includes(q.trim().toLowerCase()))
	);
	const val = (f: Field) => {
		const v = values[f.key];
		if (f.secret) return '';
		return v === undefined ? (typeof f.default === 'string' ? f.default : '') : String(v);
	};
	const checked = (f: Field) => (values[f.key] === undefined ? f.default === true : values[f.key] === true);
</script>

{#if !fixed}
	<div class="picker">
		<label class="search">
			<span class="vh">Search services</span>
			<input class="input" type="search" bind:value={q} placeholder="Search {providers.length} services" />
		</label>
		<div class="grid" role="radiogroup" aria-label="Service">
			{#each shown as x (x.id)}
				<button type="button" role="radio" aria-checked={picked === x.id} class:on={picked === x.id} onclick={() => (picked = x.id)}>{x.name}</button>
			{/each}
		</div>
	</div>
{/if}

{#key picked}
	<form
		method="POST"
		action={fixed ? '?/save' : '?/create'}
		class="form"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<input type="hidden" name="provider" value={picked} />
		<div class="ph">
			<span class="mono">{p.mono}</span>
			<span class="t-heading">{p.name}</span>
			{#if p.docs}<a class="t-xs" href={p.docs} target="_blank" rel="noopener noreferrer">Setup guide ↗</a>{/if}
		</div>
		<label class="field">
			Channel name
			<input class="input" name="name" value={name} placeholder="e.g. Ops group" maxlength="60" />
		</label>
		{#each p.fields as f (f.key)}
			{#if f.type === 'checkbox'}
				<label class="check"><input type="checkbox" name="f_{f.key}" checked={checked(f)} />{f.label}</label>
				{#if f.help}<span class="help t-xs t-muted">{f.help}</span>{/if}
			{:else}
				<label class="field">
					{f.label}{f.required ? '' : ' (optional)'}
					{#if f.type === 'select'}
						<select class="select" name="f_{f.key}" value={val(f)}>
							{#each f.options ?? [] as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
						</select>
					{:else if f.type === 'textarea'}
						<textarea class="textarea" name="f_{f.key}" placeholder={f.secret && values[f.key] ? '•••••• saved — leave empty to keep' : f.placeholder} spellcheck="false">{val(f)}</textarea>
					{:else}
						<input
							class="input"
							name="f_{f.key}"
							type={f.secret ? 'password' : f.type === 'number' ? 'text' : f.type}
							inputmode={f.type === 'number' ? 'numeric' : undefined}
							value={val(f)}
							placeholder={f.secret && values[f.key] ? '•••••• saved — leave empty to keep' : f.placeholder}
							autocomplete="off"
							aria-invalid={errors[f.key] ? 'true' : undefined}
						/>
					{/if}
					{#if errors[f.key]}<span class="error">{errors[f.key]}</span>{:else if f.help}<span class="help">{f.help}</span>{/if}
					{#if f.secret}<span class="help">Stored encrypted; never shown again.</span>{/if}
				</label>
			{/if}
		{/each}
		<label class="check"><input type="checkbox" name="default_on" checked={defaultOn} />Turn on for new monitors</label>
		{#if showApplyAll}
			<label class="check"><input type="checkbox" name="apply_all" />Also turn on for every existing monitor</label>
		{/if}
		<div class="bar">
			{#if fixed}<button class="btn" formaction="?/test" disabled={busy}>Send test</button>{/if}
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
		</div>
	</form>
{/key}

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--bonk-line);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
		max-height: 244px;
		overflow: auto;
	}
	.grid button {
		min-height: 44px;
		padding: 0 8px;
		border: 1px solid var(--bonk-line);
		border-radius: var(--bonk-radius-sm);
		background: var(--bonk-bg);
		color: var(--bonk-ink);
		font-family: var(--bonk-font-heading);
		font-size: 13px;
		cursor: pointer;
	}
	.grid button.on {
		background: var(--bonk-ink);
		border-color: var(--bonk-ink);
		color: var(--bonk-bg);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-top: 18px;
	}
	.ph {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.ph a {
		margin-left: auto;
	}
	.mono {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		background: var(--bonk-ink);
		color: var(--bonk-bg);
		border-radius: var(--bonk-radius-sm);
		font-family: var(--bonk-font-heading);
		font-weight: 700;
		font-size: 13px;
	}
	.help {
		margin-top: -10px;
	}
	.bar {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}
</style>
