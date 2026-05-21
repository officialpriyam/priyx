import type { PriyxClient } from './client';
import { GuildModuleSetting } from '../addons/core/database/models/GuildModuleSetting';
import type { ModuleName, ModulesConfig, ModuleValue } from './types/modules';

type GuildModuleConfig<K extends ModuleName> = ModulesConfig[K] & {
	enabled?: boolean;
};

function isRecord(value: unknown): value is Record<string, ModuleValue> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
	base: Record<string, ModuleValue>,
	override: Record<string, ModuleValue>,
): Record<string, ModuleValue> {
	const merged: Record<string, ModuleValue> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const baseValue = merged[key];
		if (isRecord(baseValue) && isRecord(value)) {
			merged[key] = deepMerge(baseValue, value);
			continue;
		}

		merged[key] = value;
	}

	return merged;
}

function mergeConfig<K extends ModuleName>(
	base: ModulesConfig[K],
	override?: GuildModuleSetting | null,
): GuildModuleConfig<K> {
	if (!isRecord(base)) {
		return base as GuildModuleConfig<K>;
	}

	const overrideConfig = isRecord(override?.config) ? override.config : {};
	return {
		...deepMerge(base, overrideConfig),
		enabled:
			override?.enabled ??
			('enabled' in base ? Boolean(base.enabled) : true),
	} as GuildModuleConfig<K>;
}

export async function getGuildModule<K extends ModuleName>(
	client: PriyxClient,
	guildId: string,
	moduleName: K,
): Promise<GuildModuleConfig<K>> {
	const cacheKey = `guild:${guildId}:module:${moduleName}`;
	const cached = await client.cache.get<GuildModuleConfig<K>>(cacheKey);
	if (cached) {
		return cached;
	}

	const override = await GuildModuleSetting.findOne({
		where: { guildId, moduleName },
	});
	const merged = mergeConfig(client.module(moduleName), override);
	await client.cache.set(cacheKey, merged, client.module('bot').redis.ttl.userdata);
	return merged;
}

export async function isGuildModuleEnabled(
	client: PriyxClient,
	guildId: string,
	moduleName: ModuleName,
): Promise<boolean> {
	const config = await getGuildModule(client, guildId, moduleName);
	return 'enabled' in config ? Boolean(config.enabled) : true;
}

export async function setGuildModuleEnabled(
	client: PriyxClient,
	guildId: string,
	moduleName: ModuleName,
	enabled: boolean,
): Promise<GuildModuleSetting> {
	const [setting] = await GuildModuleSetting.findOrCreate({
		where: { guildId, moduleName },
		defaults: { guildId, moduleName, enabled, config: {} },
	});
	setting.enabled = enabled;
	await setting.save();
	await client.cache.delete(`guild:${guildId}:module:${moduleName}`);
	return setting;
}

export async function updateGuildModuleConfig(
	client: PriyxClient,
	guildId: string,
	moduleName: ModuleName,
	config: Record<string, ModuleValue>,
): Promise<GuildModuleSetting> {
	const [setting] = await GuildModuleSetting.findOrCreate({
		where: { guildId, moduleName },
		defaults: { guildId, moduleName, enabled: true, config },
	});
	setting.config = { ...setting.config, ...config };
	await setting.save();
	await client.cache.delete(`guild:${guildId}:module:${moduleName}`);
	return setting;
}
