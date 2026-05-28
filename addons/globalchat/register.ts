import type { PriyxClient } from '../../src/client';
import { PriyxAddon } from '../../src/structures/Addon';

class GlobalchatAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'globalchat',
			description: 'Cross-server chat bridge configuration.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set(
			'addon:globalchat:loaded',
			true,
			client.module('bot').redis.ttl.default,
		);
	}
}

export default new GlobalchatAddon();
