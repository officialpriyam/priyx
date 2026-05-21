import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class LevelingAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'leveling',
			description: 'XP, levels, rank cards, and level roles.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:leveling:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new LevelingAddon();
