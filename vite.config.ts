import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// Workers runtime modules; resolved by workerd, not bundled.
	build: { rolldownOptions: { external: [/^cloudflare:/] } },
	test: { include: ['src/**/*.test.ts'] }
});
