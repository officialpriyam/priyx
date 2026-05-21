import type { Client, PermissionResolvable, REST } from 'discord.js';
import type { Sequelize } from 'sequelize';
import type { CacheStore } from '../redis';
import type { ModulesConfig } from '../types/modules';

export interface CoreLogger {
	info: (message: string, ...metadata: unknown[]) => void;
	warn: (message: string, ...metadata: unknown[]) => void;
	error: (message: string, ...metadata: unknown[]) => void;
	debug: (message: string, ...metadata: unknown[]) => void;
}

export interface CoreContainer {
	client: Client;
	config: ModulesConfig;
	logger: CoreLogger;
	cache?: CacheStore;
	sequelize?: Sequelize;
	rest?: REST;
	models: Record<string, unknown>;
	helpers: Record<string, unknown>;
	utils: Record<string, unknown>;
}

export interface CommandData {
	name: string;
	description: string;
	cooldown: number;
	permissions: PermissionResolvable[];
	ownerOnly: boolean;
	guildOnly: boolean;
}

export interface CoreAddonManifest {
	name: string;
	description: string;
	version: string;
	author?: string;
	enabled?: boolean;
	priority?: number;
	dependencies?: string[];
}
