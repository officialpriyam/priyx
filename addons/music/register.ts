import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';
import { setupRainlink } from './helpers';

class MusicAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'music',
			description: 'Optional music queue and playback state.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set(
			'addon:music:loaded',
			true,
			client.module('bot').redis.ttl.default,
		);
		setupRainlink(client);
	}
}

export default new MusicAddon();
