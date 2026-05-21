import {
	ApplicationCommandOptionType,
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type APIApplicationCommandOption,
	type ChatInputCommandInteraction,
	type GuildMember,
	type Message,
	type Role,
	type User,
} from 'discord.js';
import type { PriyxClient } from '../client';
import { moderationPermissions } from '../constants/permissions';
import { PriyxCommand } from '../structures/Command';
import type { ModuleName } from '../types/modules';
import { ModerationLog } from '../../addons/core/database/models/ModerationLog';
import { Warning } from '../../addons/core/database/models/Warning';
import {
	buttonRow,
	linkButton,
	primaryButton,
	secondaryButton,
	selectRow,
	stringSelect,
} from './components';
import {
	buildV2Container,
	buildV2Embed,
	componentsV2Flags,
	errorEmbed,
	primaryEmbed,
	successEmbed,
} from './embed';
import { paginate } from './paginator';
import { formatDuration } from './time';
import { titleCase } from './string';
import {
	guildModulePanelContainer,
	guildModuleDescription,
} from './guildModulePanel';

export interface AddonAction {
	name: string;
	description: string;
	list?: boolean;
}

export function createAddonCommand(
	moduleName: ModuleName,
	description: string,
	actions: AddonAction[],
): PriyxCommand {
	const builder = new SlashCommandBuilder()
		.setName(moduleName)
		.setDescription(description);

	for (const action of actions) {
		builder.addSubcommand((subcommand) =>
			subcommand.setName(action.name).setDescription(action.description),
		);
	}

	return new PriyxCommand({
		data: builder,
		category: moduleName,
		addon: moduleName,
		async execute(interaction, client) {
			if (!interaction.guild) {
				await interaction.reply({
					embeds: [errorEmbed('Server only', 'Addon commands are server-scoped.')],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const subcommand = interaction.options.getSubcommand(false);
			const action = actions.find((item) => item.name === subcommand);
			const title = `${titleCase(moduleName)} ${titleCase(subcommand ?? 'panel')}`;

			if (action?.list || subcommand?.includes('leaderboard')) {
				await interaction.reply({
					components: [
						await guildModulePanelContainer(
							client,
							interaction.guild.id,
							moduleName,
							title,
						),
					],
					flags: componentsV2Flags,
				});
				return;
			}

			await interaction.reply({
				components: [
					await guildModulePanelContainer(
						client,
						interaction.guild.id,
						moduleName,
						title,
					),
				],
				flags: componentsV2Flags,
			});
		},
	});
}

export function createPingCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('ping')
			.setDescription('Check Priyx latency, shard, database, and cache status.'),
		category: 'core',
		addon: 'core',
		cooldown: 5,
		async execute(interaction, client) {
			await interaction.deferReply();
			const sentAt = Date.now();
			const cacheKind = client.cache.kind;
			const dbStart = Date.now();

			await client.sequelize.authenticate();
			const dbLatency = Date.now() - dbStart;

			await interaction.editReply({
				components: [
					buildV2Container({
						title: `${client.module('bot').name} Ping`,
						description: [
							`Bot latency: **${Math.max(0, sentAt - interaction.createdTimestamp)}ms**`,
							`Discord API: **${Math.round(client.ws.ping)}ms**`,
							`Database: **${dbLatency}ms**`,
							`Cache: **${cacheKind}**`,
							`Shard: **${interaction.guild?.shardId ?? 0}**`,
						].join('\n'),
						actionRows: [
							buttonRow(primaryButton('core:ping:refresh', 'Refresh')),
						],
					}),
				],
				flags: componentsV2Flags,
			});
		},
	});
}

export function createAboutCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('about')
			.setDescription('Show Priyx runtime information.'),
		category: 'core',
		addon: 'core',
		async execute(interaction, client) {
			const bot = client.module('bot');
			const uptime = formatDuration(Math.floor(process.uptime()));
			const container = buildV2Embed('Priyx', [
				`**Name**\n${bot.name}`,
				`**Version**\n${bot.version}`,
				`**Uptime**\n${uptime}`,
				`**Guilds**\n${client.guilds.cache.size}`,
				`**Commands**\n${client.commands.size}`,
			]);

			await interaction.reply({
				components: [container],
				flags: componentsV2Flags,
			});
		},
	});
}

interface HelpState {
	categoryPage: number;
	selectedCategory?: string;
}

interface HelpCategory {
	label: string;
	value: string;
	description: string;
	commands: PriyxCommand[];
}

const helpCategoriesPerPage = 25;

function visibleHelpCommands(client: PriyxClient): PriyxCommand[] {
	return [...client.commands.values()].filter((command) => !command.ownerOnly);
}

function commandUsages(command: PriyxCommand): string[] {
	const data = command.data.toJSON();
	const options = (data.options ?? []) as APIApplicationCommandOption[];
	const usages: string[] = [];

	for (const option of options) {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			usages.push(
				`/${data.name} ${option.name} - ${option.description ?? data.description}`,
			);
			continue;
		}

		if (
			option.type === ApplicationCommandOptionType.SubcommandGroup &&
			Array.isArray(option.options)
		) {
			for (const subcommand of option.options) {
				usages.push(
					`/${data.name} ${option.name} ${subcommand.name} - ${subcommand.description ?? data.description}`,
				);
			}
		}
	}

	if (usages.length === 0) {
		usages.push(`/${data.name} - ${data.description}`);
	}

	return usages;
}

function buildHelpCategories(client: PriyxClient): HelpCategory[] {
	const grouped = new Map<string, PriyxCommand[]>();

	for (const command of visibleHelpCommands(client)) {
		const commands = grouped.get(command.category) ?? [];
		commands.push(command);
		grouped.set(command.category, commands);
	}

	return [...grouped.entries()]
		.map(([category, commands]) => ({
			label: titleCase(category),
			value: category,
			description: `${commands.length} command group(s)`,
			commands: commands.sort((left, right) =>
				left.data.name.localeCompare(right.data.name),
			),
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

function totalHelpUsages(categories: HelpCategory[]): number {
	return categories.reduce(
		(total, category) =>
			total +
			category.commands.reduce(
				(commandTotal, command) => commandTotal + commandUsages(command).length,
				0,
			),
		0,
	);
}

function helpDescription(
	client: PriyxClient,
	interaction: ChatInputCommandInteraction,
	categories: HelpCategory[],
	state: HelpState,
): { title: string; description: string } {
	const bot = client.module('bot');
	if (state.selectedCategory) {
		const category = categories.find((item) => item.value === state.selectedCategory);
		if (!category) {
			return {
				title: `${bot.name} Help`,
				description: 'That category is not available.',
			};
		}

		const lines = category.commands.flatMap((command) =>
			commandUsages(command).map((usage) => `\`${usage.split(' - ')[0]}\` - ${usage.split(' - ').slice(1).join(' - ')}`),
		);

		return {
			title: `${category.label} Commands`,
			description:
				lines.slice(0, 22).join('\n') ||
				'No commands are currently loaded for this category.',
		};
	}

	return {
		title: `${bot.name} Help`,
		description: [
			`**Commands:** ${totalHelpUsages(categories)}`,
			`**Categories:** ${categories.length}`,
			`**Server:** ${interaction.guild?.name ?? 'Direct Message'}`,
			'Choose a category below to inspect commands.',
		].join('\n'),
	};
}

function buildHelpPayload(
	client: PriyxClient,
	interaction: ChatInputCommandInteraction,
	state: HelpState,
) {
	const categories = buildHelpCategories(client);
	const totalCategoryPages = Math.max(
		1,
		Math.ceil(categories.length / helpCategoriesPerPage),
	);
	const categoryPage = Math.min(
		Math.max(0, state.categoryPage),
		totalCategoryPages - 1,
	);
	const start = categoryPage * helpCategoriesPerPage;
	const categoryOptions = categories
		.slice(start, start + helpCategoriesPerPage)
		.map((category) => ({
			label: category.label,
			value: category.value,
			description: category.description,
			default: category.value === state.selectedCategory,
		}));
	const helpId = interaction.id;
	const rows = [
		selectRow(
			stringSelect(
				`core:help:select:${helpId}`,
				`Browse ${client.module('bot').name} commands`,
				categoryOptions,
			),
		),
		buttonRow(
			secondaryButton(`core:help:home:${helpId}`, 'Home').setDisabled(
				!state.selectedCategory,
			),
			secondaryButton(`core:help:prev:${helpId}`, 'Prev').setDisabled(
				categoryPage <= 0,
			),
			secondaryButton(`core:help:next:${helpId}`, 'Next').setDisabled(
				categoryPage >= totalCategoryPages - 1,
			),
		),
	];
	const content = helpDescription(client, interaction, categories, {
		...state,
		categoryPage,
	});

	return {
		components: [
			buildV2Container({
				title: content.title,
				description: content.description,
				actionRows: rows,
				footer: `${client.module('bot').name} help menu`,
			}),
		],
		flags: componentsV2Flags,
	};
}

async function createHelpCollector(
	message: Message,
	interaction: ChatInputCommandInteraction,
	client: PriyxClient,
): Promise<void> {
	let state: HelpState = { categoryPage: 0 };
	const collector = message.createMessageComponentCollector({
		filter: (componentInteraction) =>
			componentInteraction.user.id === interaction.user.id &&
			componentInteraction.customId.startsWith(`core:help:`) &&
			componentInteraction.customId.endsWith(interaction.id),
		time: 120_000,
	});

	collector.on('collect', async (componentInteraction) => {
		if (componentInteraction.isStringSelectMenu()) {
			state = {
				...state,
				selectedCategory: componentInteraction.values.at(0),
			};
		} else if (componentInteraction.isButton()) {
			const action = componentInteraction.customId.split(':')[2];
			if (action === 'home') {
				state = { ...state, selectedCategory: undefined };
			}

			if (action === 'prev') {
				state = { ...state, categoryPage: Math.max(0, state.categoryPage - 1) };
			}

			if (action === 'next') {
				state = { ...state, categoryPage: state.categoryPage + 1 };
			}
		}

		await componentInteraction.update(
			buildHelpPayload(client, interaction, state),
		);
	});

	collector.on('end', async () => {
		await interaction
			.editReply({
				components: [
					buildV2Container({
						title: `${client.module('bot').name} Help`,
						description: 'This help menu expired. Run `/help` again to reopen it.',
						footer: `${client.module('bot').name} help menu`,
					}),
				],
				flags: componentsV2Flags,
			})
			.catch(() => undefined);
	});
}

export function createHelpCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('help')
			.setDescription('Show Priyx command categories.'),
		category: 'core',
		addon: 'core',
		async execute(interaction, client) {
			await interaction.reply(buildHelpPayload(client, interaction, { categoryPage: 0 }));
			const message = await interaction.fetchReply();
			await createHelpCollector(message, interaction, client);
		},
	});
}

export function createServerInfoCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('serverinfo')
			.setDescription('Show server information.'),
		category: 'core',
		addon: 'core',
		async execute(interaction) {
			const guild = interaction.guild;
			if (!guild) {
				await interaction.reply({
					embeds: [errorEmbed('Server only', 'Use this command in a server.')],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await interaction.reply({
				embeds: [
					primaryEmbed(
						guild.name,
						[
							`ID: **${guild.id}**`,
							`Members: **${guild.memberCount}**`,
							`Channels: **${guild.channels.cache.size}**`,
							`Roles: **${guild.roles.cache.size}**`,
							`Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
						].join('\n'),
					),
				],
			});
		},
	});
}

export function createUserInfoCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('userinfo')
			.setDescription('Show user information.')
			.addUserOption((option) =>
				option.setName('user').setDescription('Target user.'),
			),
		category: 'core',
		addon: 'core',
		async execute(interaction) {
			const user = interaction.options.getUser('user') ?? interaction.user;
			const member = interaction.guild
				? await interaction.guild.members.fetch(user.id).catch(() => null)
				: null;

			await interaction.reply({
				embeds: [
					primaryEmbed(
						user.tag,
						[
							`ID: **${user.id}**`,
							`Bot: **${user.bot}**`,
							`Created: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
							member?.joinedTimestamp
								? `Joined: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
								: 'Joined: unavailable',
						].join('\n'),
					),
				],
			});
		},
	});
}

export function createAvatarCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('avatar')
			.setDescription('Show a user avatar.')
			.addUserOption((option) =>
				option.setName('user').setDescription('Target user.'),
			),
		category: 'core',
		addon: 'core',
		async execute(interaction) {
			const user = interaction.options.getUser('user') ?? interaction.user;
			await interaction.reply({
				embeds: [
					{
						...primaryEmbed(`${user.username}'s Avatar`, user.displayAvatarURL()),
						image: { url: user.displayAvatarURL({ size: 1024 }) },
					},
				],
				components: [
					buttonRow(linkButton('Open in browser', user.displayAvatarURL({ size: 1024 }))),
				],
			});
		},
	});
}

async function getTargetMember(
	interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
	const user = interaction.options.getUser('user');
	if (!user || !interaction.guild) {
		return null;
	}

	return interaction.guild.members.fetch(user.id).catch(() => null);
}

function getTargetUser(interaction: ChatInputCommandInteraction): User | null {
	return interaction.options.getUser('user');
}

interface BulkDeleteChannel {
	bulkDelete(amount: number, filterOld?: boolean): Promise<unknown>;
}

function canBulkDelete(channel: unknown): channel is BulkDeleteChannel {
	return (
		typeof channel === 'object' &&
		channel !== null &&
		'bulkDelete' in channel &&
		typeof channel.bulkDelete === 'function'
	);
}

async function createModerationLog(
	interaction: ChatInputCommandInteraction,
	action: string,
	targetId: string,
	reason: string | null,
): Promise<void> {
	if (!interaction.guild) {
		return;
	}

	await ModerationLog.create({
		guildId: interaction.guild.id,
		moderatorId: interaction.user.id,
		targetId,
		action,
		reason,
	});
}

export function createModerationCommand(
	name:
		| 'ban'
		| 'kick'
		| 'mute'
		| 'unmute'
		| 'warn'
		| 'clearwarnings'
		| 'clear'
		| 'slowmode'
		| 'lock'
		| 'unlock',
	description: string,
): PriyxCommand {
	const builder = new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

	if (['ban', 'kick', 'mute', 'unmute', 'warn', 'clearwarnings'].includes(name)) {
		builder.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('Target user.')
				.setRequired(true),
		);
	}

	if (name === 'mute') {
		builder.addIntegerOption((option) =>
			option
				.setName('minutes')
				.setDescription('Timeout length in minutes.')
				.setMinValue(1)
				.setMaxValue(40320),
		);
	}

	if (['ban', 'kick', 'mute', 'warn'].includes(name)) {
		builder.addStringOption((option) =>
			option.setName('reason').setDescription('Moderation reason.'),
		);
	}

	if (name === 'clear') {
		builder.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('Messages to delete.')
				.setMinValue(1)
				.setMaxValue(100)
				.setRequired(true),
		);
	}

	if (name === 'slowmode') {
		builder.addIntegerOption((option) =>
			option
				.setName('seconds')
				.setDescription('Slowmode seconds.')
				.setMinValue(0)
				.setMaxValue(21600)
				.setRequired(true),
		);
	}

	const permissions = {
		ban: [moderationPermissions.ban],
		kick: [moderationPermissions.kick],
		mute: [moderationPermissions.mute],
		unmute: [moderationPermissions.mute],
		warn: [moderationPermissions.mute],
		clearwarnings: [moderationPermissions.mute],
		clear: [moderationPermissions.clear],
		slowmode: [moderationPermissions.channel],
		lock: [moderationPermissions.channel],
		unlock: [moderationPermissions.channel],
	}[name];

	return new PriyxCommand({
		data: builder,
		category: 'core',
		addon: 'core',
		permissions,
		async execute(interaction) {
			await interaction.deferReply();
			const reason =
				interaction.options.getString('reason') ?? 'No reason provided.';

			if (name === 'ban') {
				const user = getTargetUser(interaction);
				if (!user || !interaction.guild) {
					await interaction.editReply({
						embeds: [errorEmbed('Missing user', 'Target user was not found.')],
					});
					return;
				}

				await interaction.guild.members.ban(user, { reason });
				await createModerationLog(interaction, 'ban', user.id, reason);
				await interaction.editReply({
					embeds: [successEmbed('Banned', `${user.tag} was banned.`)],
				});
				return;
			}

			if (name === 'kick') {
				const member = await getTargetMember(interaction);
				if (!member) {
					await interaction.editReply({
						embeds: [errorEmbed('Missing member', 'Target member was not found.')],
					});
					return;
				}

				await member.kick(reason);
				await createModerationLog(interaction, 'kick', member.id, reason);
				await interaction.editReply({
					embeds: [successEmbed('Kicked', `${member.user.tag} was kicked.`)],
				});
				return;
			}

			if (name === 'mute' || name === 'unmute') {
				const member = await getTargetMember(interaction);
				if (!member) {
					await interaction.editReply({
						embeds: [errorEmbed('Missing member', 'Target member was not found.')],
					});
					return;
				}

				const minutes = interaction.options.getInteger('minutes') ?? 10;
				await member.timeout(name === 'mute' ? minutes * 60_000 : null, reason);
				await createModerationLog(interaction, name, member.id, reason);
				await interaction.editReply({
					embeds: [
						successEmbed(
							name === 'mute' ? 'Muted' : 'Unmuted',
							`${member.user.tag} was ${name === 'mute' ? 'muted' : 'unmuted'}.`,
						),
					],
				});
				return;
			}

			if (name === 'warn') {
				const user = getTargetUser(interaction);
				if (!user || !interaction.guild) {
					await interaction.editReply({
						embeds: [errorEmbed('Missing user', 'Target user was not found.')],
					});
					return;
				}

				const warning = await Warning.create({
					guildId: interaction.guild.id,
					userId: user.id,
					moderatorId: interaction.user.id,
					reason,
				});
				await createModerationLog(interaction, 'warn', user.id, reason);
				await interaction.editReply({
					embeds: [
						successEmbed(
							'Warning added',
							`Warning **#${warning.id}** was added for ${user.tag}.`,
						),
					],
				});
				return;
			}

			if (name === 'clearwarnings') {
				const user = getTargetUser(interaction);
				if (!user || !interaction.guild) {
					await interaction.editReply({
						embeds: [errorEmbed('Missing user', 'Target user was not found.')],
					});
					return;
				}

				const deleted = await Warning.destroy({
					where: { guildId: interaction.guild.id, userId: user.id },
				});
				await createModerationLog(
					interaction,
					'clearwarnings',
					user.id,
					`Cleared ${deleted} warning(s).`,
				);
				await interaction.editReply({
					embeds: [
						successEmbed(
							'Warnings cleared',
							`Deleted **${deleted}** warning(s) for ${user.tag}.`,
						),
					],
				});
				return;
			}

			if (name === 'clear') {
				const amount = interaction.options.getInteger('amount', true);
				if (!canBulkDelete(interaction.channel)) {
					await interaction.editReply({
						embeds: [errorEmbed('Unsupported channel', 'Cannot bulk delete here.')],
					});
					return;
				}

				await interaction.channel.bulkDelete(amount, true);
				await createModerationLog(
					interaction,
					'clear',
					interaction.channel.id,
					`Deleted ${amount} message(s).`,
				);
				await interaction.editReply({
					embeds: [successEmbed('Messages cleared', `Deleted ${amount} message(s).`)],
				});
				return;
			}

			if (name === 'slowmode') {
				const seconds = interaction.options.getInteger('seconds', true);
				if (
					!interaction.channel ||
					interaction.channel.type !== ChannelType.GuildText
				) {
					await interaction.editReply({
						embeds: [errorEmbed('Unsupported channel', 'Use this in a text channel.')],
					});
					return;
				}

				await interaction.channel.setRateLimitPerUser(seconds, reason);
				await createModerationLog(
					interaction,
					'slowmode',
					interaction.channel.id,
					`${seconds} second(s).`,
				);
				await interaction.editReply({
					embeds: [successEmbed('Slowmode updated', `${seconds} second(s).`)],
				});
				return;
			}

			if (name === 'lock' || name === 'unlock') {
				if (!interaction.guild || !interaction.channel) {
					await interaction.editReply({
						embeds: [errorEmbed('Server only', 'Use this command in a server.')],
					});
					return;
				}

				const channel = interaction.channel as typeof interaction.channel & {
					permissionOverwrites?: {
						edit: (
							target: unknown,
							options: { SendMessages: boolean },
						) => Promise<unknown>;
					};
				};

				if (!channel.permissionOverwrites) {
					await interaction.editReply({
						embeds: [
							errorEmbed('Unsupported channel', 'Cannot edit permissions here.'),
						],
					});
					return;
				}

				await channel.permissionOverwrites.edit(
					interaction.guild.roles.everyone,
					{ SendMessages: name === 'unlock' },
				);
				await createModerationLog(
					interaction,
					name,
					interaction.channel.id,
					null,
				);
				await interaction.editReply({
					embeds: [
						successEmbed(
							name === 'lock' ? 'Locked' : 'Unlocked',
							`Channel ${name === 'lock' ? 'locked' : 'unlocked'}.`,
						),
					],
				});
				return;
			}
		},
	});
}

export function createWarningsCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('warnings')
			.setDescription('List warnings for a user.')
			.addUserOption((option) =>
				option.setName('user').setDescription('Target user.').setRequired(true),
			),
		category: 'core',
		addon: 'core',
		permissions: [moderationPermissions.mute],
		async execute(interaction) {
			if (!interaction.guild) {
				await interaction.reply({
					embeds: [errorEmbed('Server only', 'Use this command in a server.')],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const user = interaction.options.getUser('user', true);
			const warnings = await Warning.findAll({
				where: { guildId: interaction.guild.id, userId: user.id },
				order: [['createdAt', 'DESC']],
				limit: 50,
			});

			if (warnings.length === 0) {
				await interaction.reply({
					embeds: [primaryEmbed(`Warnings for ${user.tag}`, 'No warnings found.')],
				});
				return;
			}

			const pages = [];
			for (let index = 0; index < warnings.length; index += 10) {
				const chunk = warnings.slice(index, index + 10);
				pages.push(
					primaryEmbed(
						`Warnings for ${user.tag}`,
						chunk
							.map((warning) =>
								[
									`**#${warning.id}**`,
									`Moderator: <@${warning.moderatorId}>`,
									`Reason: ${warning.reason}`,
									`Created: <t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`,
								].join(' | '),
							)
							.join('\n'),
					),
				);
			}

			await paginate(interaction, pages);
		},
	});
}

export function createRoleCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('role')
			.setDescription('Add or remove a role from a member.')
			.addStringOption((option) =>
				option
					.setName('action')
					.setDescription('Role action.')
					.setRequired(true)
					.addChoices(
						{ name: 'add', value: 'add' },
						{ name: 'remove', value: 'remove' },
					),
			)
			.addUserOption((option) =>
				option.setName('user').setDescription('Target user.').setRequired(true),
			)
			.addRoleOption((option) =>
				option.setName('role').setDescription('Role.').setRequired(true),
			),
		category: 'core',
		addon: 'core',
		permissions: [moderationPermissions.role],
		async execute(interaction) {
			await interaction.deferReply();
			const action = interaction.options.getString('action', true);
			const member = await getTargetMember(interaction);
			const role = interaction.options.getRole('role', true) as Role;

			if (!member) {
				await interaction.editReply({
					embeds: [errorEmbed('Missing member', 'Target member was not found.')],
				});
				return;
			}

			if (action === 'add') {
				await member.roles.add(role);
			} else {
				await member.roles.remove(role);
			}

			await interaction.editReply({
				embeds: [successEmbed('Role updated', `${action} ${role.name}.`)],
			});
		},
	});
}

export function createSettingsCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('settings')
			.setDescription('Open the Priyx server settings panel.'),
		category: 'core',
		addon: 'core',
		permissions: [PermissionFlagsBits.ManageGuild],
		async execute(interaction, client) {
			if (!interaction.guild) {
				await interaction.reply({
					embeds: [errorEmbed('Server only', 'Settings are stored per server.')],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const modules = Object.entries(client.modules)
				.filter(([, value]) => typeof value === 'object' && value !== null)
				.filter(([name]) => !['bot', 'colors', 'presence'].includes(name))
				.slice(0, 25)
				.map(([name, value]) => ({
					label: titleCase(name),
					value: name,
					description:
						'enabled' in value
							? `Enabled: ${String(value.enabled)}`
							: 'Global configuration',
				}));

			await interaction.reply({
				components: [
					buildV2Container({
						title: `${client.module('bot').name} Settings`,
						description: await guildModuleDescription(
							client,
							interaction.guild.id,
							'core',
						),
						actionRows: [
							selectRow(
								stringSelect(
									'core:settings:module',
									'Choose a module',
									modules,
								),
							),
						],
						footer: `${client.module('bot').name} server settings`,
					}),
				],
				flags: componentsV2Flags,
			});
		},
	});
}

export function createMaintenanceCommand(): PriyxCommand {
	return new PriyxCommand({
		data: new SlashCommandBuilder()
			.setName('maintenance')
			.setDescription('Show the configured maintenance message.'),
		category: 'core',
		addon: 'core',
		ownerOnly: true,
		async execute(interaction, client) {
			await interaction.reply({
				embeds: [
					primaryEmbed('Maintenance', client.module('core').maintenanceMessage),
				],
			});
		},
	});
}
