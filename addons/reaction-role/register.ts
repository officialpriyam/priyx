import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class ReactionRoleAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'reaction-role',
			description: 'Reaction role panels and role options.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:reaction-role:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new ReactionRoleAddon();
