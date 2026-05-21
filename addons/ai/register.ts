import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class AiAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'ai',
			description: 'AI chat history, user facts, and translation state.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:ai:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new AiAddon();
