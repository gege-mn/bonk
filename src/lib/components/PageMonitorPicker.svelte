<script lang="ts">
	import { tick, untrack } from 'svelte';

	interface Row {
		monitor_id: number;
		group_name: string;
		display_name: string | null;
	}
	interface Mon {
		id: number;
		name: string;
		public_name: string | null;
		type: string;
		target: string;
	}
	interface Item {
		id: number;
		display: string;
	}
	interface Group {
		/** Stable identity while the name is being typed. 0 is the ungrouped one. */
		key: number;
		name: string;
		items: Item[];
	}

	let {
		rows,
		monitors,
		dirty = $bindable(false),
		valid = $bindable(true)
	}: { rows: Row[]; monitors: Mon[]; dirty?: boolean; valid?: boolean } = $props();

	let nextKey = 1;
	// The status page keys groups by name, so rows sharing one are gathered even if they were stored apart.
	function build(list: Row[]): Group[] {
		const out: Group[] = [{ key: 0, name: '', items: [] }];
		for (const r of list) {
			const name = r.group_name.trim();
			let g = out.find((x) => x.name === name);
			if (!g) out.push((g = { key: nextKey++, name, items: [] }));
			g.items.push({ id: r.monitor_id, display: r.display_name ?? '' });
		}
		return out;
	}
	const serialize = (gs: Group[]) =>
		JSON.stringify(
			gs.flatMap((g) => g.items.map((i) => ({ monitor_id: i.id, group_name: g.key === 0 ? '' : g.name.trim(), display_name: i.display.trim() })))
		);

	// Edits live here until Save; the rows prop only moves the baseline they are compared with.
	let groups = $state(untrack(() => build(rows)));
	let root: HTMLElement;

	const byId = $derived(new Map(monitors.map((m) => [m.id, m])));
	const used = $derived(new Set(groups.flatMap((g) => g.items.map((i) => i.id))));
	const available = $derived(monitors.filter((m) => !used.has(m.id)));
	const value = $derived(serialize(groups));
	const baseline = $derived(serialize(build(rows)));
	const named = $derived(groups.length > 1);

	function problem(g: Group): string | null {
		if (g.key === 0) return null;
		const name = g.name.trim();
		if (!name) return 'Give the group a name.';
		if (groups.some((o) => o !== g && o.key !== 0 && o.name.trim() === name)) return 'Another group has this name.';
		return null;
	}
	$effect(() => {
		dirty = value !== baseline;
		// An empty group isn't saved, so its name can't block saving.
		valid = groups.every((g) => g.items.length === 0 || !problem(g));
	});

	const label = (g: Group) => (g.key === 0 ? 'Ungrouped' : g.name.trim() || 'Unnamed group');

	// Moving a row between groups recreates its buttons, so the keyboard would lose its place.
	async function refocus(...selectors: string[]) {
		await tick();
		for (const s of selectors) {
			const el = root.querySelector<HTMLElement>(s);
			if (el && !(el as HTMLButtonElement).disabled) return el.focus();
		}
	}

	function place(id: number, toKey: number, index: number) {
		const from = groups.find((g) => g.items.some((i) => i.id === id));
		const to = groups.find((g) => g.key === toKey);
		if (!from || !to) return;
		const at = from.items.findIndex((i) => i.id === id);
		const [item] = from.items.splice(at, 1);
		if (from === to && at < index) index--;
		to.items.splice(Math.max(0, Math.min(index, to.items.length)), 0, item);
	}

	/** One step up or down; at a group's edge the monitor crosses into the neighbouring group. */
	function step(gi: number, ii: number, d: -1 | 1) {
		const g = groups[gi];
		const id = g.items[ii].id;
		const j = ii + d;
		if (j >= 0 && j < g.items.length) [g.items[ii], g.items[j]] = [g.items[j], g.items[ii]];
		else {
			const next = groups[gi + d];
			if (!next) return;
			place(id, next.key, d < 0 ? next.items.length : 0);
		}
		const dir = d < 0 ? 'up' : 'down';
		refocus(`[data-act="${dir}-${id}"]`, `[data-act="${d < 0 ? 'down' : 'up'}-${id}"]`);
	}

	function regroup(id: number, toKey: number) {
		place(id, toKey, Infinity);
		refocus(`[data-act="group-${id}"]`);
	}

	function remove(gi: number, ii: number) {
		groups[gi].items.splice(ii, 1);
		refocus('[data-act="search"]', '[data-act^="add-"]');
	}

	// ---- Groups ----
	async function addGroup() {
		const key = nextKey++;
		groups.push({ key, name: '', items: [] });
		addTo = key;
		refocus(`[data-act="gname-${key}"]`);
	}
	function stepGroup(gi: number, d: -1 | 1) {
		const j = gi + d;
		// Slot 0 is the ungrouped list, which always leads.
		if (j < 1 || j >= groups.length) return;
		const key = groups[gi].key;
		[groups[gi], groups[j]] = [groups[j], groups[gi]];
		refocus(`[data-act="gup-${key}"]`, `[data-act="gdown-${key}"]`);
	}
	function removeGroup(gi: number) {
		const [g] = groups.splice(gi, 1);
		groups[0].items.push(...g.items);
		if (addTo === g.key) addTo = 0;
		refocus('[data-act="addgroup"]');
	}

	// ---- Adding ----
	let addTo = $state(0);
	let q = $state('');
	const shown = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return available;
		return available.filter((m) => `${m.name} ${m.public_name ?? ''} ${m.target} ${m.type}`.toLowerCase().includes(needle));
	});
	function add(id: number) {
		const g = groups.find((x) => x.key === addTo) ?? groups[0];
		g.items.push({ id, display: '' });
	}
	function addAll() {
		const g = groups.find((x) => x.key === addTo) ?? groups[0];
		g.items.push(...shown.map((m) => ({ id: m.id, display: '' })));
	}

	// ---- Drag and drop (a pointer shortcut; the buttons do everything it does) ----
	let dragId = $state<number | null>(null);
	let over = $state<{ key: number; index: number } | null>(null);

	function dragStart(e: DragEvent, id: number) {
		dragId = id;
		const dt = e.dataTransfer;
		if (!dt) return;
		dt.effectAllowed = 'move';
		// Firefox won't start a drag without data.
		dt.setData('text/plain', byId.get(id)?.name ?? '');
		const row = (e.currentTarget as HTMLElement).closest('li');
		if (row) dt.setDragImage(row, 12, 12);
	}
	function overRow(e: DragEvent, key: number, ii: number) {
		if (dragId === null) return;
		e.preventDefault();
		e.stopPropagation();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		over = { key, index: e.clientY > r.top + r.height / 2 ? ii + 1 : ii };
	}
	function overGroup(e: DragEvent, g: Group) {
		if (dragId === null) return;
		e.preventDefault();
		over = { key: g.key, index: g.items.length };
	}
	function drop(e: DragEvent) {
		if (dragId === null || !over) return;
		e.preventDefault();
		place(dragId, over.key, over.index);
		dragEnd();
	}
	function dragEnd() {
		dragId = null;
		over = null;
	}
</script>

<input type="hidden" name="monitors" {value} />

<div class="picker" bind:this={root}>
	<div class="groups">
		{#if used.size === 0}
			<p class="t-small t-muted lead">No monitors on this page yet. Add some from the list{named ? '' : ', and group them if you like'}.</p>
		{/if}
		{#each groups as g, gi (g.key)}
			{@const bad = problem(g)}
			<section
				class="group"
				class:target={dragId !== null && over?.key === g.key}
				aria-label={label(g)}
				ondragover={(e) => overGroup(e, g)}
				ondrop={drop}
			>
				{#if g.key === 0}
					{#if named}<p class="t-eyebrow ungrouped">Ungrouped · shown first, without a heading</p>{/if}
				{:else}
					<div class="ghead">
						<label class="field gname">
							<span class="vh">Group name</span>
							<input
								class="input"
								bind:value={g.name}
								maxlength="60"
								placeholder="Group name"
								data-act="gname-{g.key}"
								aria-invalid={bad && g.items.length ? 'true' : undefined}
							/>
							{#if bad && (g.items.length || g.name.trim())}<span class="error">{bad}</span>{/if}
						</label>
						<span class="ctl">
							<button type="button" class="btn btn-sm btn-icon" data-act="gup-{g.key}" disabled={gi <= 1} onclick={() => stepGroup(gi, -1)} aria-label="Move group {label(g)} up">↑</button>
							<button type="button" class="btn btn-sm btn-icon" data-act="gdown-{g.key}" disabled={gi === groups.length - 1} onclick={() => stepGroup(gi, 1)} aria-label="Move group {label(g)} down">↓</button>
							<button type="button" class="btn btn-sm btn-quiet" onclick={() => removeGroup(gi)} aria-label="Remove group {label(g)}; its monitors become ungrouped">Remove group</button>
						</span>
					</div>
				{/if}
				<ul class="rows list" class:bare={g.key === 0 && !named}>
					{#each g.items as it, ii (it.id)}
						{@const m = byId.get(it.id)}
						<li
							class="row"
							class:dragging={dragId === it.id}
							class:before={dragId !== null && over?.key === g.key && over.index === ii}
							class:after={dragId !== null && over?.key === g.key && over.index === g.items.length && ii === g.items.length - 1}
							ondragover={(e) => overRow(e, g.key, ii)}
						>
							<!-- svelte-ignore a11y_no_static_element_interactions (pointer-only shortcut; the arrow buttons are the accessible path) -->
							<span class="grip" draggable="true" ondragstart={(e) => dragStart(e, it.id)} ondragend={dragEnd} aria-hidden="true" title="Drag to reorder">⠿</span>
							<span class="who">
								<span class="t-heading mname">{m?.name ?? `Monitor ${it.id}`}</span>
								<span class="t-xs t-muted target">{m?.type} · {m?.target}</span>
							</span>
							<input
								class="input shown-as"
								bind:value={it.display}
								maxlength="80"
								placeholder={m?.public_name || m?.name}
								aria-label="Name shown on this page for {m?.name}"
							/>
							{#if named}
								<select
									class="select gsel"
									data-act="group-{it.id}"
									aria-label="Group for {m?.name}"
									value={g.key}
									onchange={(e) => regroup(it.id, Number(e.currentTarget.value))}
								>
									{#each groups as o (o.key)}<option value={o.key}>{label(o)}</option>{/each}
								</select>
							{/if}
							<span class="ctl">
								<button type="button" class="btn btn-sm btn-icon" data-act="up-{it.id}" disabled={ii === 0 && gi === 0} onclick={() => step(gi, ii, -1)} aria-label="Move {m?.name} up">↑</button>
								<button type="button" class="btn btn-sm btn-icon" data-act="down-{it.id}" disabled={ii === g.items.length - 1 && gi === groups.length - 1} onclick={() => step(gi, ii, 1)} aria-label="Move {m?.name} down">↓</button>
								<button type="button" class="btn btn-sm btn-quiet" onclick={() => remove(gi, ii)} aria-label="Remove {m?.name} from this page">Remove</button>
							</span>
						</li>
					{:else}
						{#if g.key !== 0 || named}
							<li class="t-small t-muted hollow">{g.key === 0 ? 'No ungrouped monitors.' : 'Empty. Add monitors here, or it won’t be saved.'}</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/each}
		<div><button type="button" class="btn btn-sm" data-act="addgroup" onclick={addGroup}>Add group</button></div>
	</div>

	<aside class="panel">
		<div class="panel-head">
			<h2 class="t-heading">Add monitors</h2>
			<span class="t-xs t-muted t-num">{used.size} of {monitors.length} on this page</span>
		</div>
		<div class="panel-body stack">
			{#if available.length === 0}
				<p class="t-small t-muted">Every monitor is on this page. <a href="/admin/monitors/new">Add a monitor</a></p>
			{:else}
				{#if named}
					<label class="field">
						Add to
						<select class="select" bind:value={addTo}>
							{#each groups as o (o.key)}<option value={o.key}>{label(o)}</option>{/each}
						</select>
					</label>
				{/if}
				{#if available.length > 6}
					<label class="field">
						<span class="vh">Search monitors</span>
						<input class="input" type="search" bind:value={q} data-act="search" placeholder="Search by name or target" />
					</label>
				{/if}
				<ul class="rows avail">
					{#each shown as m (m.id)}
						<li>
							<span class="who">
								<span class="mname">{m.name}</span>
								<span class="t-xs t-muted target">{m.type} · {m.target}</span>
							</span>
							<button type="button" class="btn btn-sm" data-act="add-{m.id}" onclick={() => add(m.id)} aria-label="Add {m.name}">Add</button>
						</li>
					{:else}
						<li class="t-small t-muted hollow">Nothing matches “{q}”.</li>
					{/each}
				</ul>
				{#if shown.length > 1}
					<div><button type="button" class="btn btn-sm btn-quiet" onclick={addAll}>Add all {shown.length}</button></div>
				{/if}
			{/if}
		</div>
	</aside>
</div>

<style>
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 380px;
		gap: 48px;
		align-items: start;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 28px;
		min-width: 0;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.group.target {
		outline: 1px dashed var(--bonk-accent);
		outline-offset: 6px;
	}
	.ghead {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
	}
	.gname {
		flex: 1 1 auto;
		max-width: 360px;
	}
	.gname .input {
		font-family: var(--bonk-font-heading);
		font-weight: 700;
	}
	.list,
	.avail {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* With no groups at all there is nothing to rule the list off from. */
	.list.bare:empty {
		display: none;
	}
	.row {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
		padding: 8px 0;
	}
	.row:has(.gsel) {
		grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 160px) auto;
	}
	.row.dragging {
		opacity: 0.4;
	}
	.row.before {
		box-shadow: inset 0 2px 0 var(--bonk-accent);
	}
	.row.after {
		box-shadow: inset 0 -2px 0 var(--bonk-accent);
	}
	.grip {
		cursor: grab;
		color: var(--bonk-muted);
		text-align: center;
		line-height: 36px;
		user-select: none;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.mname,
	.target {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mname {
		font-size: 14px;
	}
	.ctl {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: none;
	}
	.ctl .btn-icon {
		width: 36px;
		font-size: 16px;
	}
	.hollow {
		padding: 14px 0;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.panel h2 {
		font-size: 16px;
	}
	.avail {
		max-height: 420px;
		overflow-y: auto;
	}
	.avail li:not(.hollow) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}
	@media (max-width: 1100px) {
		.picker {
			grid-template-columns: minmax(0, 1fr);
			gap: 28px;
		}
	}
	@media (max-width: 900px) {
		.ghead {
			flex-wrap: wrap;
		}
		.row,
		.row:has(.gsel) {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		/* Native drag doesn't work on touch; the arrows do. */
		.grip {
			display: none;
		}
		.shown-as,
		.gsel {
			grid-column: 1 / -1;
		}
		.who {
			grid-row: 1;
		}
		.ctl {
			grid-row: 1;
			grid-column: 2;
		}
	}
</style>
