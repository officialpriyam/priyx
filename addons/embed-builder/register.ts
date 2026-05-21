import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class EmbedBuilderAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'embed-builder',
			description: 'Saved embeds and component builder state.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:embed-builder:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new EmbedBuilderAddon();
