import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class PetAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'pet',
			description: 'Pet ownership, care state, and gacha results.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:pet:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new PetAddon();
