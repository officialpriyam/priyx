import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class TempvoiceAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'tempvoice',
			description: 'Temporary voice configuration and ownership.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:tempvoice:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new TempvoiceAddon();
