import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class AutoreplyAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'autoreply',
			description: 'Automatic reply rules.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:autoreply:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new AutoreplyAddon();
