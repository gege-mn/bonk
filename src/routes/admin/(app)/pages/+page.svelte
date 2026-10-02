<script lang="ts">
	let { data } = $props();
</script>

<div class="head">
	<div class="title">
		<h1 class="t-display t-display-l">Status pages</h1>
		<p class="t-small t-muted">Each page shows the monitors you pick for it, under its own name, address and look. The default page is the one at <code>/</code>.</p>
	</div>
	<a class="btn btn-primary" href="/admin/pages/new">New page</a>
</div>

<div class="rows">
	{#each data.pages as p (p.id)}
		{@const addr = p.is_default ? '/' : `/${p.slug}`}
		<div class="row">
			<a class="name t-heading" href="/admin/pages/{p.id}">{p.name}</a>
			<a class="addr t-small" href={addr} target="_blank" rel="noopener">{addr} ↗</a>
			<span class="tags">
				<span class="tag {p.public ? 's-up' : 's-none'}">{p.public ? 'Public' : 'Private'}</span>
				{#if p.is_default}<span class="tag s-maintenance">Default</span>{/if}
			</span>
			<span class="t-small t-muted t-num count">{p.monitors} {p.monitors === 1 ? 'monitor' : 'monitors'}</span>
			<a class="btn btn-sm" href="/admin/pages/{p.id}/monitors">Monitors</a>
		</div>
	{:else}
		<p class="empty">No status pages yet.</p>
	{/each}
</div>

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		flex-wrap: wrap;
	}
	.title {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 640px;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 190px 110px auto;
		gap: 16px;
		align-items: center;
		padding: 12px 0;
	}
	.name {
		font-size: 16px;
		color: var(--bonk-ink);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		/* Keeps the row's main link a 44px target. */
		line-height: 44px;
	}
	.name:hover {
		text-decoration: underline;
	}
	.addr {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tags {
		display: flex;
		gap: 6px;
	}
	@media (max-width: 900px) {
		.row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 4px 16px;
		}
		.count {
			text-align: right;
		}
		.row .btn {
			display: none;
		}
	}
</style>
