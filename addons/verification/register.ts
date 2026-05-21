import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class VerificationAddon extends PriyxAddon {
	public constructor() {
		super({
			name: 'verification',
			description: 'Verification panels, roles, and captcha sessions.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		await client.cache.set('addon:verification:loaded', true, client.module('bot').redis.ttl.default);
	}
}

export default new VerificationAddon();
