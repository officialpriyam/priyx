import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class AutoreactAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'autoreact',
			description: 'Automatic reaction rules.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:autoreact:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new AutoreactAddon();
