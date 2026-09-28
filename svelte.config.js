import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter({
			config: 'wrangler.sveltekit.jsonc',
			platformProxy: { configPath: 'wrangler.jsonc' }
		})
	}
};
