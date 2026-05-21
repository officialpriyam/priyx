import type { CoreAddonManifest, CoreContainer } from './types';

export abstract class BaseAddon<TSetupTarget = CoreContainer> {
	public readonly name: string;
	public readonly description: string;
	public readonly version: string;
	public readonly author: string;
	public readonly priority: number;
	public readonly dependencies: string[];
	public enabled: boolean;

	public constructor(manifest: CoreAddonManifest) {
		this.name = manifest.name;
		this.description = manifest.description;
		this.version = manifest.version;
		this.author = manifest.author ?? 'Priyx';
		this.priority = manifest.priority ?? 50;
		this.dependencies = manifest.dependencies ?? [];
		this.enabled = manifest.enabled ?? true;
	}

	public abstract setup(target: TSetupTarget): Promise<void>;
}
