import type { PageRow } from '$lib/server/pages';
import type { BonkEnv } from '$lib/server/types';

declare global {
	namespace App {
		interface Platform {
			env: BonkEnv;
			ctx: ExecutionContext;
		}
		interface Locals {
			admin: { email: string | null; via: 'access' | 'password' } | null;
			/** The status page this request is for, set in hooks.server.ts on every route under [[slug]]. */
			page: PageRow | null;
		}
	}
}

export {};
