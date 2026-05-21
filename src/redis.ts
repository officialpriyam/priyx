import { createClient } from 'redis';
import type { BotModuleConfig } from './types/modules';

export interface CacheStore {
	readonly kind: 'redis' | 'memory';
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
	delete(key: string): Promise<void>;
	has(key: string): Promise<boolean>;
	clear(): Promise<void>;
	wrap<T>(
		key: string,
		ttlSeconds: number,
		factory: () => Promise<T>,
	): Promise<T>;
}

interface MemoryEntry {
	value: unknown;
	expiresAt?: number;
}

export class MemoryCacheStore implements CacheStore {
	public readonly kind = 'memory' as const;
	private readonly values = new Map<string, MemoryEntry>();

	public async get<T>(key: string): Promise<T | null> {
		const entry = this.values.get(key);
		if (!entry) {
			return null;
		}

		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.values.delete(key);
			return null;
		}

		return entry.value as T;
	}

	public async set<T>(
		key: string,
		value: T,
		ttlSeconds?: number,
	): Promise<void> {
		this.values.set(key, {
			value,
			expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
		});
	}

	public async delete(key: string): Promise<void> {
		this.values.delete(key);
	}

	public async has(key: string): Promise<boolean> {
		return (await this.get(key)) !== null;
	}

	public async clear(): Promise<void> {
		this.values.clear();
	}

	public async wrap<T>(
		key: string,
		ttlSeconds: number,
		factory: () => Promise<T>,
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const value = await factory();
		await this.set(key, value, ttlSeconds);
		return value;
	}
}

export class RedisCacheStore implements CacheStore {
	public readonly kind = 'redis' as const;

	public constructor(
		private readonly client: ReturnType<typeof createClient>,
		private readonly prefix: string,
	) {}

	private key(key: string): string {
		return `${this.prefix}${key}`;
	}

	public async get<T>(key: string): Promise<T | null> {
		const raw = await this.client.get(this.key(key));
		if (!raw) {
			return null;
		}

		return JSON.parse(raw) as T;
	}

	public async set<T>(
		key: string,
		value: T,
		ttlSeconds?: number,
	): Promise<void> {
		const payload = JSON.stringify(value);
		if (ttlSeconds) {
			await this.client.set(this.key(key), payload, { EX: ttlSeconds });
			return;
		}

		await this.client.set(this.key(key), payload);
	}

	public async delete(key: string): Promise<void> {
		await this.client.del(this.key(key));
	}

	public async has(key: string): Promise<boolean> {
		return (await this.client.exists(this.key(key))) > 0;
	}

	public async clear(): Promise<void> {
		const keys = await this.client.keys(`${this.prefix}*`);
		if (keys.length > 0) {
			await this.client.del(keys);
		}
	}

	public async wrap<T>(
		key: string,
		ttlSeconds: number,
		factory: () => Promise<T>,
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const value = await factory();
		await this.set(key, value, ttlSeconds);
		return value;
	}
}

export async function initCache(
	config: BotModuleConfig['redis'],
	onFallback?: (reason: unknown) => void,
): Promise<CacheStore> {
	if (!config.enabled) {
		return new MemoryCacheStore();
	}

	const client = createClient({
		socket: {
			host: config.host,
			port: config.port,
		},
		database: config.db,
		password: process.env.REDIS_PASSWORD || undefined,
	});

	client.on('error', () => undefined);

	try {
		await client.connect();
		await client.ping();
		return new RedisCacheStore(client, config.keyPrefix);
	} catch (error) {
		onFallback?.(error);
		await client.quit().catch(() => undefined);
		return new MemoryCacheStore();
	}
}
