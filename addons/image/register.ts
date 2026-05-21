import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class ImageAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'image',
			description: 'Image asset registry and output settings.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:image:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new ImageAddon();
