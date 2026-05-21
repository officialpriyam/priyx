import type { PriyxClient } from '../client';
import { BaseAddon } from '../core';

export interface AddonManifest {
	name: string;
	description: string;
	version: string;
	author?: string;
	enabled?: boolean;
}

export abstract class PriyxAddon extends BaseAddon<PriyxClient> {
	public constructor(manifest: AddonManifest) {
		super(manifest);
	}

	public abstract setup(client: PriyxClient): Promise<void>;
}
