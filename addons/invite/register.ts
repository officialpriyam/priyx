import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class InviteAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'invite',
			description: 'Invite tracking and leaderboard data.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:invite:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new InviteAddon();
