import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class AutomodAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'automod',
			description: 'Automated moderation rules and logs.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:automod:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new AutomodAddon();
