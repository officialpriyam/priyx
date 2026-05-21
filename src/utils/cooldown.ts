import type { PriyxClient } from '../client';

export async function checkCooldown(
	client: PriyxClient,
	key: string,
	ttlSeconds: number,
): Promise<number> {
	const expiresAt = await client.cache.get<number>(key);
	const now = Date.now();

	if (expiresAt && expiresAt > now) {
		return Math.ceil((expiresAt - now) / 1000);
	}

	await client.cache.set(key, now + ttlSeconds * 1000, ttlSeconds);
	return 0;
}
