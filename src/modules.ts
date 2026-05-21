import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { ModuleName, ModulesConfig } from './types/modules';

let cachedConfig: ModulesConfig | undefined;

function modulesPath(): string {
	return path.resolve(process.cwd(), 'modules.yml');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeShards(value: unknown): number | 'auto' {
	if (value === 'auto') {
		return 'auto';
	}

	if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
		return value;
	}

	return 'auto';
}

function asModulesConfig(value: unknown): ModulesConfig {
	if (!isRecord(value)) {
		throw new Error('modules.yml must contain a YAML object.');
	}

	const bot = isRecord(value.bot) ? value.bot : {};
	const sharding = isRecord(bot.sharding) ? bot.sharding : {};
	const redis = isRecord(bot.redis) ? bot.redis : {};
	const redisTtl = isRecord(redis.ttl) ? redis.ttl : {};

	const config = value as Partial<ModulesConfig> & Record<string, unknown>;
	config.bot = {
		name: String(bot.name ?? 'Priyx'),
		studio: String(bot.studio ?? 'Priyx'),
		developer: String(bot.developer ?? 'Priyx'),
		version: String(bot.version ?? '1.0.0'),
		prefix: String(bot.prefix ?? '!'),
		sharding: {
			totalShards: normalizeShards(sharding.totalShards),
		},
		database: {
			sync: Boolean(isRecord(bot.database) ? bot.database.sync : true),
			logging: Boolean(isRecord(bot.database) ? bot.database.logging : false),
		},
		redis: {
			enabled: Boolean(redis.enabled ?? false),
			host: String(redis.host ?? 'localhost'),
			port: Number(redis.port ?? 6379),
			db: Number(redis.db ?? 0),
			keyPrefix: String(redis.keyPrefix ?? 'priyx:'),
			ttl: {
				default: Number(redisTtl.default ?? 300),
				cooldown: Number(redisTtl.cooldown ?? 60),
				leaderboard: Number(redisTtl.leaderboard ?? 120),
				userdata: Number(redisTtl.userdata ?? 600),
			},
		},
	};

	return config as ModulesConfig;
}

export function loadModulesConfig(force = false): ModulesConfig {
	if (cachedConfig && !force) {
		return cachedConfig;
	}

	const raw = readFileSync(modulesPath(), 'utf8');
	cachedConfig = asModulesConfig(parse(raw));
	return cachedConfig;
}

export function getModulesConfig(): ModulesConfig {
	return loadModulesConfig();
}

export function getModule<K extends ModuleName>(name: K): ModulesConfig[K] {
	const config = loadModulesConfig();
	return config[name];
}

export function isModuleEnabled(name: ModuleName): boolean {
	const moduleConfig = getModule(name);
	if (
		typeof moduleConfig === 'object' &&
		moduleConfig !== null &&
		'enabled' in moduleConfig
	) {
		return Boolean(moduleConfig.enabled);
	}

	return true;
}

export function reloadModulesConfig(): ModulesConfig {
	return loadModulesConfig(true);
}
