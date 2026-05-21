import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class EconomyAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'economy',
			description: 'Coins, wallets, banks, shops, and rewards.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:economy:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new EconomyAddon();
