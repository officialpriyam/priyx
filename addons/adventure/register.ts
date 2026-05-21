import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class AdventureAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'adventure',
			description: 'Adventure profiles, inventory, and combat state.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:adventure:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new AdventureAddon();
