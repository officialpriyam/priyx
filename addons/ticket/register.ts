import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class TicketAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'ticket',
			description: 'Ticket panels, channels, claims, and transcripts.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:ticket:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new TicketAddon();
