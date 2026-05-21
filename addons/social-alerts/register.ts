import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class SocialAlertsAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'social-alerts',
			description: 'Social platform alert subscriptions.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:social-alerts:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new SocialAlertsAddon();
