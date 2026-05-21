import { REST, type Client } from 'discord.js';
import type { Sequelize } from 'sequelize';
import type { CacheStore } from '../redis';
import type { ModulesConfig } from '../types/modules';
import type { CoreContainer, CoreLogger } from './types';

export class PriyxCore {
	public readonly client: Client;
	public readonly config: ModulesConfig;
	public readonly logger: CoreLogger;
	public readonly cache?: CacheStore;
	public readonly sequelize?: Sequelize;
	public readonly rest: REST;
	public readonly container: CoreContainer;

	public constructor(options: {
		client: Client;
		config: ModulesConfig;
		logger: CoreLogger;
		cache?: CacheStore;
		sequelize?: Sequelize;
		rest?: REST;
		models?: Record<string, unknown>;
		helpers?: Record<string, unknown>;
		utils?: Record<string, unknown>;
	}) {
		this.client = options.client;
		this.config = options.config;
		this.logger = options.logger;
		this.cache = options.cache;
		this.sequelize = options.sequelize;
		this.rest = options.rest ?? new REST({ version: '10' });
		this.container = {
			client: options.client,
			config: options.config,
			logger: options.logger,
			cache: options.cache,
			sequelize: options.sequelize,
			rest: this.rest,
			models: options.models ?? {},
			helpers: options.helpers ?? {},
			utils: options.utils ?? {},
		};
	}

	public async start(token: string): Promise<void> {
		await this.client.login(token);
	}
}
