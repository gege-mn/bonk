<main class="wrap">
	<div class="panel card">
		<h1 class="t-display t-display-l">Lock the door first</h1>
		<p>The admin is closed until this Worker knows who may open it. Pick one:</p>
		<ol class="steps">
			<li>
				<strong>Password.</strong> In the Cloudflare dashboard open <em>Workers &amp; Pages → bonk → Settings → Variables and Secrets</em>,
				add a secret named <code>ADMIN_PASSWORD</code>, and deploy.
			</li>
			<li>
				<strong>Cloudflare Access</strong> (recommended). Protect <code>/admin</code> with an Access application, then add
				<code>CF_TEAM_DOMAIN</code> (e.g. <code>https://yourteam.cloudflareaccess.com</code>) and <code>CF_AUD_TOKEN</code> (the
				application's AUD tag). When both are set, the password is ignored.
			</li>
		</ol>
		<p class="t-small t-muted">Reload this page once the variable is saved.</p>
	</div>
</main>

<style>
	.wrap {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.card {
		width: min(640px, 100%);
		padding: 32px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		line-height: 1.6;
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
</style>
