import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class StreakAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'streak',
			description: 'Activity streak progress and reset state.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:streak:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new StreakAddon();
