import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class BirthdayAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'birthday',
			description: 'Birthday dates, roles, and announcements.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:birthday:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new BirthdayAddon();
