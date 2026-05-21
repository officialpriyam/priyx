import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class GiveawayAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'giveaway',
			description: 'Giveaway entries, winners, and schedules.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:giveaway:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new GiveawayAddon();
