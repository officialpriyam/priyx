import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class SuggestionAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'suggestion',
			description: 'Suggestion submissions, votes, and statuses.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:suggestion:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new SuggestionAddon();
