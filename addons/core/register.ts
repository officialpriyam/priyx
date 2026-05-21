import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class CoreAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'core',
			description: 'Core utility, moderation, and settings commands.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:core:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new CoreAddon();
