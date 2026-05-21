import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class FunAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'fun',
			description: 'Trivia, word games, and casual commands.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:fun:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new FunAddon();
