import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class WelcomerAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'welcomer',
			description: 'Welcome, farewell, DM, and card settings.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:welcomer:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new WelcomerAddon();
