import {
	ActivityType,
	Client,
	Collection,
	Events,
	GatewayIntentBits,
	MessageFlags,
	Options,
	Partials,
	type AnySelectMenuInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type ClientOptions,
	type ModalSubmitInteraction,
} from 'discord.js';
import type { Rainlink } from 'rainlink';
import { createDatabase, initializeModels, prepareDatabase } from './database';
import {
	getGuildModule,
	isGuildModuleEnabled,
	setGuildModuleEnabled,
	updateGuildModuleConfig,
} from './guildModules';
import { loadAddons } from './loader';
import { addonLogger, logger } from './logger';
import { getModule, getModulesConfig } from './modules';
import { initCache, MemoryCacheStore, type CacheStore } from './redis';
import { PriyxCommand } from './structures/Command';
import type {
	PriyxButtonHandler,
	PriyxModalHandler,
	PriyxSelectMenuHandler,
} from './types/addon';
import { checkCooldown } from './utils/cooldown';
import { errorEmbed } from './utils/embed';
import type { ModuleName, ModulesConfig } from './types/modules';
import type { ModuleValue } from './types/modules';

const activityTypes: Record<string, ActivityType> = {
	PLAYING: ActivityType.Playing,
	STREAMING: ActivityType.Streaming,
	LISTENING: ActivityType.Listening,
	WATCHING: ActivityType.Watching,
	COMPETING: ActivityType.Competing,
};

export class PriyxClient extends Client {
	public readonly commands = new Collection<string, PriyxCommand>();
	public readonly buttons = new Collection<string, PriyxButtonHandler>();
	public readonly selectMenus = new Collection<
		string,
		PriyxSelectMenuHandler
	>();
	public readonly modals = new Collection<string, PriyxModalHandler>();
	public readonly logger = logger;
	public readonly addonLogger = addonLogger;
	public readonly modules: ModulesConfig;
	public cache: CacheStore = new MemoryCacheStore();
	public rainlink?: Rainlink;
	public readonly sequelize;

	public constructor(options: Partial<ClientOptions> = {}) {
		super({
			waitGuildTimeout: 60_000,
			closeTimeout: 60_000,
			rest: {
				timeout: 60_000,
				retries: 5,
			},
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildInvites,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.GuildMessageReactions,
			],
			partials: [
				Partials.Message,
				Partials.Channel,
				Partials.Reaction,
				Partials.User,
				Partials.GuildMember,
			],
			makeCache: Options.cacheWithLimits({
				PresenceManager: 0,
				ThreadManager: { maxSize: 25 },
				GuildMemberManager: { maxSize: 2000 },
				UserManager: { maxSize: 20000 },
			}),
			...options,
		});

		this.modules = getModulesConfig();
		this.sequelize = createDatabase(this.modules.bot.database);
		this.priyxCommands = this.commands;
		this.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isChatInputCommand()) {
				await this.handleCommand(interaction);
				return;
			}

			if (interaction.isButton()) {
				await this.handleButton(interaction);
				return;
			}

			if (interaction.isAnySelectMenu()) {
				await this.handleSelectMenu(interaction);
				return;
			}

			if (interaction.isModalSubmit()) {
				await this.handleModal(interaction);
			}
		});
	}

	public module<K extends ModuleName>(name: K): ModulesConfig[K] {
		return getModule(name);
	}

	public guildModule<K extends ModuleName>(
		guildId: string,
		name: K,
	): Promise<ModulesConfig[K] & { enabled?: boolean }> {
		return getGuildModule(this, guildId, name);
	}

	public isGuildModuleEnabled(
		guildId: string,
		name: ModuleName,
	): Promise<boolean> {
		return isGuildModuleEnabled(this, guildId, name);
	}

	public setGuildModuleEnabled(
		guildId: string,
		name: ModuleName,
		enabled: boolean,
	) {
		return setGuildModuleEnabled(this, guildId, name, enabled);
	}

	public updateGuildModuleConfig(
		guildId: string,
		name: ModuleName,
		config: Record<string, ModuleValue>,
	) {
		return updateGuildModuleConfig(this, guildId, name, config);
	}

	public async start(): Promise<void> {
		this.cache = await initCache(this.modules.bot.redis, (reason) => {
			this.logger.warn('Redis unavailable; using in-memory cache fallback.');
			this.logger.debug(String(reason));
		});

		await this.sequelize.authenticate();
		await prepareDatabase(this.sequelize);
		await initializeModels(this.sequelize);
		if (this.modules.bot.database.sync) {
			await this.sequelize.sync();
		}

		await loadAddons(this);
		this.once(Events.ClientReady, () => this.applyPresence());

		const token = process.env.DISCORD_TOKEN;
		if (!token) {
			throw new Error('DISCORD_TOKEN is required in .env.');
		}

		await this.login(token);
	}

	private applyPresence(): void {
		const presence = this.module('presence');
		const firstActivity = presence.activities[0];

		this.user?.setPresence({
			status: presence.status,
			activities: firstActivity
				? [
						{
							name: firstActivity.name.replace(
								'{guilds}',
								String(this.guilds.cache.size),
							),
							type: activityTypes[firstActivity.type] ?? ActivityType.Watching,
						},
					]
				: [],
		});
	}

	private async handleCommand(
		interaction: ChatInputCommandInteraction,
	): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			await interaction.reply({
				embeds: [errorEmbed('Unknown command', 'This command is not loaded.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (command.ownerOnly && !this.isOwner(interaction.user.id)) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Owner only',
						'Only Priyx bot owners can use this command.',
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (
			interaction.guild &&
			command.addon !== 'core' &&
			!command.bypassModuleDisabled &&
			!(await this.isGuildModuleEnabled(
				interaction.guild.id,
				command.addon as ModuleName,
			))
		) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Module disabled',
						`The **${command.addon}** module is disabled in this server.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		for (const permission of command.permissions) {
			if (!interaction.memberPermissions?.has(permission)) {
				await interaction.reply({
					embeds: [
						errorEmbed(
							'Missing permission',
							`You need the ${String(permission)} permission.`,
						),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
		}

		const ttl = command.cooldown || this.module('core').defaultCooldown;
		const cooldown = await checkCooldown(
			this,
			`cooldown:${command.data.name}:${interaction.user.id}`,
			ttl,
		);

		if (cooldown > 0) {
			await interaction.reply({
				embeds: [errorEmbed('Cooldown', `Try again in ${cooldown} second(s).`)],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			await command.execute(interaction, this);
		} catch (error) {
			this.addonLogger(command.addon).error('Command error:', error);
			const payload = {
				embeds: [
					errorEmbed('Error', 'Something went wrong. Please try again.'),
				],
			};

			if (interaction.deferred || interaction.replied) {
				await interaction.editReply(payload).catch(() => undefined);
			} else {
				await interaction
					.reply({ ...payload, flags: MessageFlags.Ephemeral })
					.catch(() => undefined);
			}
		}
	}

	private findComponent<
		T extends { customId: string; match?: 'exact' | 'prefix' },
	>(handlers: Collection<string, T>, customId: string): T | undefined {
		return (
			handlers.get(customId) ??
			[...handlers.values()].find(
				(handler) =>
					handler.match === 'prefix' && customId.startsWith(handler.customId),
			)
		);
	}

	private isModuleSettingsComponent(customId: string): boolean {
		return (
			customId.includes(':settings:') ||
			customId.includes(':setup:') ||
			customId.endsWith(':panel') ||
			customId.endsWith(':modal')
		);
	}

	private async handleButton(interaction: ButtonInteraction): Promise<void> {
		const handler = this.findComponent(this.buttons, interaction.customId);
		if (!handler) {
			return;
		}

		if (
			interaction.guild &&
			handler.addon !== 'core' &&
			!this.isModuleSettingsComponent(interaction.customId) &&
			!(await this.isGuildModuleEnabled(
				interaction.guild.id,
				handler.addon as ModuleName,
			))
		) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Module disabled',
						`The **${handler.addon}** module is disabled in this server.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await handler.execute(interaction, this);
	}

	private async handleSelectMenu(
		interaction: AnySelectMenuInteraction,
	): Promise<void> {
		const handler = this.findComponent(this.selectMenus, interaction.customId);
		if (!handler) {
			return;
		}

		if (
			interaction.guild &&
			handler.addon !== 'core' &&
			!this.isModuleSettingsComponent(interaction.customId) &&
			!(await this.isGuildModuleEnabled(
				interaction.guild.id,
				handler.addon as ModuleName,
			))
		) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Module disabled',
						`The **${handler.addon}** module is disabled in this server.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await (
			handler.execute as (
				interaction: AnySelectMenuInteraction,
				client: PriyxClient,
			) => Promise<void>
		)(interaction, this);
	}

	private async handleModal(
		interaction: ModalSubmitInteraction,
	): Promise<void> {
		const handler = this.findComponent(this.modals, interaction.customId);
		if (!handler) {
			return;
		}

		if (
			interaction.guild &&
			handler.addon !== 'core' &&
			!this.isModuleSettingsComponent(interaction.customId) &&
			!(await this.isGuildModuleEnabled(
				interaction.guild.id,
				handler.addon as ModuleName,
			))
		) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Module disabled',
						`The **${handler.addon}** module is disabled in this server.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await handler.execute(interaction, this);
	}

	private isOwner(userId: string): boolean {
		return (process.env.OWNER_IDS ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.includes(userId);
	}
}
