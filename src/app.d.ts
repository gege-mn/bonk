import type { BonkEnv } from '$lib/server/types';

declare global {
	namespace App {
		interface Platform {
			env: BonkEnv;
			ctx: ExecutionContext;
		}
		interface Locals {
			admin: { email: string | null; via: 'access' | 'password' } | null;
		}
	}
}

export {};
