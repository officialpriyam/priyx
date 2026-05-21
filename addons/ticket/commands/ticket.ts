import {
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type GuildMember,
	type TextBasedChannel,
} from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import type {
	ModuleValue,
	TicketModuleConfig,
} from '../../../src/types/modules';
import {
	buildV2Container,
	componentsV2ReplyFlags,
} from '../../../src/utils/embed';
import { Ticket } from '../database/models/Ticket';
import {
	closeTicket,
	createTicketSetupDraft,
	createTicketChannel,
	findTicketByChannel,
	isTicketStaff,
	panelContainer,
	replyTicket,
	sendTranscript,
	ticketSetupContainer,
	ticketCategories,
	ticketData,
} from '../helpers';

interface PanelChannel {
	id: string;
	send(payload: unknown): Promise<{ id: string }>;
}

function isPanelChannel(channel: unknown): channel is PanelChannel {
	if (typeof channel !== 'object' || channel === null) {
		return false;
	}

	const candidate = channel as { id?: unknown; send?: unknown; type?: unknown };
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.send === 'function' &&
		(candidate.type === ChannelType.GuildText ||
			candidate.type === ChannelType.GuildAnnouncement)
	);
}

function supportRoleIds(config: TicketModuleConfig): string[] {
	return (config.supportRoles ?? []).filter(
		(roleId): roleId is string =>
			typeof roleId === 'string' && roleId.length > 0,
	);
}

function channelText(channelId?: string): string {
	return channelId ? `<#${channelId}>` : 'Not set';
}

function roleText(roleIds: string[]): string {
	return roleIds.length > 0
		? roleIds.map((roleId) => `<@&${roleId}>`).join(', ')
		: 'Manage Channels / Manage Server';
}

async function requireGuildMember(
	interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
	if (!interaction.guild) {
		await replyTicket(
			interaction,
			'Server only',
			'Tickets can only be used in a server.',
		);
		return null;
	}

	const member = await interaction.guild.members
		.fetch(interaction.user.id)
		.catch(() => null);
	if (!member) {
		await replyTicket(
			interaction,
			'Member unavailable',
			'Could not load your server member data.',
		);
		return null;
	}

	return member;
}

async function requireManageGuild(
	interaction: ChatInputCommandInteraction,
): Promise<boolean> {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await replyTicket(
			interaction,
			'Missing permission',
			'You need Manage Server to configure tickets.',
		);
		return false;
	}

	return true;
}

async function requireTicketEnabled(
	interaction: ChatInputCommandInteraction,
	client: Parameters<PriyxCommand['execute']>[1],
): Promise<boolean> {
	if (!interaction.guild) {
		await replyTicket(
			interaction,
			'Server only',
			'Tickets can only be used in a server.',
		);
		return false;
	}

	if (await client.isGuildModuleEnabled(interaction.guild.id, 'ticket')) {
		return true;
	}

	await replyTicket(
		interaction,
		'Ticket addon disabled',
		'Ask a server admin to enable the ticket addon with `/addons enable addon:ticket` or run `/ticket setup`.',
	);
	return false;
}

async function currentTicket(
	interaction: ChatInputCommandInteraction,
): Promise<Ticket | null> {
	if (!interaction.guild) {
		await replyTicket(
			interaction,
			'Server only',
			'Tickets can only be used in a server.',
		);
		return null;
	}

	const ticket = await findTicketByChannel(
		interaction.guild.id,
		interaction.channelId,
	);
	if (!ticket || ticketData(ticket).status !== 'open') {
		await replyTicket(
			interaction,
			'Not a ticket channel',
			'Use this inside an open ticket channel.',
		);
		return null;
	}

	return ticket;
}

function formatTicketConfig(
	config: TicketModuleConfig,
	enabled: boolean,
): string {
	const categories = ticketCategories(config);
	return [
		`Enabled: **${enabled ? 'true' : 'false'}**`,
		`Ticket category: **${channelText(config.category)}**`,
		`Transcript channel: **${channelText(config.transcriptChannel)}**`,
		`Log channel: **${channelText(config.logChannel)}**`,
		`Support access: **${roleText(supportRoleIds(config))}**`,
		`Max open per user: **${config.maxOpenPerUser ?? 1}**`,
		`Channel naming: **${config.naming ?? 'ticket-{username}'}**`,
		`Panel style: **${config.panelStyle === 'select' ? 'Select Menu' : 'Button'}**`,
		`Panel buttons: **${
			categories.length > 0
				? categories
						.map((category) =>
							category.channelId
								? `${category.label} -> <#${category.channelId}>`
								: category.label,
						)
						.join(', ')
				: 'Open Ticket'
		}**`,
		'',
		'Setup:',
		'1. Run `/ticket setup category-type:Button` or `category-type:Select Menu`.',
		'2. Use Title, Description, Color, Image, Thumbnail, or Buttons to edit the panel.',
		'3. In Buttons, add/edit each panel item and select the Discord category it should create tickets in.',
		'4. Press Save & Set Category, choose panel/fallback category/support role, then Save Panel.',
		'5. Use `/ticket panel` later to post another panel with the saved settings.',
	].join('\n');
}

async function postTicketPanel(
	interaction: ChatInputCommandInteraction,
	client: Parameters<PriyxCommand['execute']>[1],
	config: TicketModuleConfig,
	panelChannel: PanelChannel,
	title?: string,
	description?: string,
	patch: Record<string, ModuleValue> = {},
): Promise<void> {
	await client.updateGuildModuleConfig(interaction.guild!.id, 'ticket', patch);
	await client.setGuildModuleEnabled(interaction.guild!.id, 'ticket', true);

	const effectiveConfig = {
		...config,
		...patch,
		enabled: true,
	} as TicketModuleConfig;
	const panelMessage = await panelChannel.send({
		components: [panelContainer(effectiveConfig, title, description)],
		flags: MessageFlags.IsComponentsV2,
	});

	await Ticket.create({
		guildId: interaction.guild!.id,
		userId: null,
		data: {
			type: 'panel',
			panelChannelId: panelChannel.id,
			panelMessageId: panelMessage.id,
			title,
			description,
		},
	});
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Create and manage server support tickets.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setup')
				.setDescription('Open the interactive ticket panel setup builder.')
				.addStringOption((option) =>
					option
						.setName('category-type')
						.setDescription('Category type for the ticket panel.')
						.setRequired(true)
						.addChoices(
							{ name: 'Button', value: 'button' },
							{ name: 'Select Menu', value: 'select' },
						),
				)
				.addChannelOption((option) =>
					option
						.setName('panel_channel')
						.setDescription(
							'Optional channel where the ticket panel will be posted.',
						)
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
						),
				)
				.addChannelOption((option) =>
					option
						.setName('ticket_category')
						.setDescription(
							'Category where private ticket channels will be created.',
						)
						.addChannelTypes(ChannelType.GuildCategory),
				)
				.addRoleOption((option) =>
					option
						.setName('support_role')
						.setDescription('Role that can view and manage tickets.'),
				)
				.addChannelOption((option) =>
					option
						.setName('transcript_channel')
						.setDescription('Channel where ticket transcripts will be sent.')
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
						),
				)
				.addChannelOption((option) =>
					option
						.setName('log_channel')
						.setDescription(
							'Optional fallback log channel for ticket activity.',
						)
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
						),
				)
				.addIntegerOption((option) =>
					option
						.setName('max_open_per_user')
						.setDescription('How many open tickets one user may have.')
						.setMinValue(1)
						.setMaxValue(10),
				)
				.addStringOption((option) =>
					option
						.setName('title')
						.setDescription('Optional starting panel title.')
						.setMaxLength(80),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('panel')
				.setDescription('Post a ticket panel using this server ticket setup.')
				.addChannelOption((option) =>
					option
						.setName('panel_channel')
						.setDescription(
							'Where to post the panel. Defaults to this channel.',
						)
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
						),
				)
				.addStringOption((option) =>
					option
						.setName('title')
						.setDescription('Panel title.')
						.setMaxLength(80),
				)
				.addStringOption((option) =>
					option
						.setName('description')
						.setDescription('Panel description.')
						.setMaxLength(500),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('open')
				.setDescription('Open a private support ticket.')
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Short reason for opening this ticket.')
						.setMaxLength(300),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('close')
				.setDescription('Close the current ticket channel.')
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for closing this ticket.')
						.setMaxLength(300),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('claim')
				.setDescription('Claim the current ticket as staff.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('transcript')
				.setDescription('Send a transcript for the current ticket.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('list')
				.setDescription('List open tickets in this server.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('config')
				.setDescription('Show the effective ticket setup for this server.'),
		),
	category: 'utility',
	addon: 'ticket',
	bypassModuleDisabled: true,
	async execute(interaction, client) {
		if (!interaction.guild) {
			await replyTicket(
				interaction,
				'Server only',
				'Tickets can only be used in a server.',
			);
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);
		const config = await client.guildModule(interaction.guild.id, 'ticket');

		if (subcommand === 'setup') {
			if (!(await requireManageGuild(interaction))) {
				return;
			}

			const panelChannel =
				interaction.options.getChannel('panel_channel') ?? interaction.channel;
			if (panelChannel && !isPanelChannel(panelChannel)) {
				await replyTicket(
					interaction,
					'Invalid panel channel',
					'Choose a normal text or announcement channel for the ticket panel.',
				);
				return;
			}

			const ticketCategory =
				interaction.options.getChannel('ticket_category') ?? undefined;
			const supportRole =
				interaction.options.getRole('support_role') ?? undefined;
			const transcriptChannel =
				interaction.options.getChannel('transcript_channel') ?? undefined;
			const logChannel =
				interaction.options.getChannel('log_channel') ?? undefined;
			const title = interaction.options.getString('title') ?? undefined;
			const maxOpen =
				interaction.options.getInteger('max_open_per_user') ?? undefined;
			const categoryType = interaction.options.getString(
				'category-type',
				true,
			) as 'button' | 'select';
			const draft = createTicketSetupDraft(
				interaction.guild.id,
				interaction.user.id,
				config,
				{
					categoryType,
					panelChannelId: panelChannel?.id,
					ticketCategoryId: ticketCategory?.id,
					transcriptChannelId: transcriptChannel?.id,
					logChannelId: logChannel?.id,
					supportRoleId: supportRole?.id,
					maxOpenPerUser: maxOpen,
					title,
				},
			);

			await interaction.reply({
				components: [ticketSetupContainer(draft)],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		if (subcommand === 'panel') {
			if (!(await requireManageGuild(interaction))) {
				return;
			}

			const targetChannel =
				interaction.options.getChannel('panel_channel') ?? interaction.channel;
			if (!isPanelChannel(targetChannel)) {
				await replyTicket(
					interaction,
					'Invalid panel channel',
					'Use this in a text channel or choose `panel_channel` as a normal text/announcement channel.',
				);
				return;
			}

			const title = interaction.options.getString('title') ?? undefined;
			const description =
				interaction.options.getString('description') ?? undefined;

			await interaction.deferReply({ ephemeral: true });
			await postTicketPanel(
				interaction,
				client,
				config,
				targetChannel,
				title,
				description,
			);

			await interaction.editReply({
				components: [
					buildV2Container({
						title: 'Ticket Panel Posted',
						description: [
							`Panel posted in <#${targetChannel.id}>.`,
							'This uses your saved ticket settings.',
							'For first-time setup, run `/ticket setup category-type:Button` or `category-type:Select Menu`.',
						].join('\n'),
						footer: 'Priyx tickets',
					}),
				],
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		if (subcommand === 'config') {
			if (!(await requireManageGuild(interaction))) {
				return;
			}

			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Ticket Setup',
						description: formatTicketConfig(
							config,
							await client.isGuildModuleEnabled(interaction.guild.id, 'ticket'),
						),
						footer: 'Priyx tickets',
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		if (!(await requireTicketEnabled(interaction, client))) {
			return;
		}

		if (subcommand === 'open') {
			const member = await requireGuildMember(interaction);
			if (!member) {
				return;
			}

			const reason = interaction.options.getString('reason') ?? undefined;
			try {
				const ticket = await createTicketChannel(
					client,
					interaction.guild,
					member,
					config,
					reason,
				);
				await replyTicket(
					interaction,
					'Ticket Opened',
					`Your ticket is ready: <#${ticketData(ticket).channelId}>`,
				);
			} catch (error) {
				await replyTicket(
					interaction,
					'Could not open ticket',
					error instanceof Error
						? error.message
						: 'The ticket channel could not be created.',
				);
			}
			return;
		}

		if (subcommand === 'list') {
			const member = await requireGuildMember(interaction);
			if (!member || !(await isTicketStaff(member, config))) {
				await replyTicket(
					interaction,
					'Missing permission',
					'Only ticket staff can list open tickets.',
				);
				return;
			}

			const tickets = await Ticket.findAll({
				where: { guildId: interaction.guild.id },
				order: [['createdAt', 'DESC']],
			});
			const openTickets = tickets
				.filter((ticket) => {
					const data = ticketData(ticket);
					return data.type === 'ticket' && data.status === 'open';
				})
				.slice(0, 10);

			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Open Tickets',
						description:
							openTickets.length > 0
								? openTickets
										.map((ticket) => {
											const data = ticketData(ticket);
											return [
												`#${ticket.id}`,
												data.channelId
													? `<#${data.channelId}>`
													: 'channel missing',
												ticket.userId ? `<@${ticket.userId}>` : 'unknown user',
												data.categoryLabel ?? 'General',
												data.claimedBy
													? `claimed by <@${data.claimedBy}>`
													: 'unclaimed',
											].join(' - ');
										})
										.join('\n')
								: 'No open tickets.',
						footer: 'Priyx tickets',
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		const ticket = await currentTicket(interaction);
		if (!ticket) {
			return;
		}

		const data = ticketData(ticket);
		const member = await requireGuildMember(interaction);
		if (!member) {
			return;
		}
		const staff = await isTicketStaff(member, config);
		const owner = ticket.userId === interaction.user.id;

		if (subcommand === 'claim') {
			if (!staff) {
				await replyTicket(
					interaction,
					'Missing permission',
					'Only ticket staff can claim tickets.',
				);
				return;
			}

			ticket.data = { ...data, claimedBy: interaction.user.id };
			ticket.changed('data', true);
			await ticket.save();
			await interaction.reply({
				components: [
					buildV2Container({
						title: `Ticket #${ticket.id} Claimed`,
						description: `Claimed by <@${interaction.user.id}>.`,
						footer: 'Priyx tickets',
					}),
				],
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		if (subcommand === 'transcript') {
			if (!staff && !owner) {
				await replyTicket(
					interaction,
					'Missing permission',
					'Only the ticket owner or ticket staff can create a transcript.',
				);
				return;
			}

			await sendTranscript(
				client,
				ticket,
				interaction.channel as TextBasedChannel,
				config,
			);
			await replyTicket(
				interaction,
				'Transcript Created',
				config.transcriptChannel || config.logChannel
					? 'The transcript was sent to the configured transcript/log channel.'
					: 'The transcript was sent in this ticket channel.',
			);
			return;
		}

		if (subcommand === 'close') {
			if (!staff && !owner) {
				await replyTicket(
					interaction,
					'Missing permission',
					'Only the ticket owner or ticket staff can close this ticket.',
				);
				return;
			}

			const reason =
				interaction.options.getString('reason') ?? 'No reason provided.';
			if (config.transcriptChannel || config.logChannel) {
				await sendTranscript(
					client,
					ticket,
					interaction.channel as TextBasedChannel,
					config,
				).catch((error) => {
					client
						.addonLogger('ticket')
						.warn('Transcript before close failed:', error);
				});
			}

			await interaction.reply({
				components: [
					buildV2Container({
						title: `Closing Ticket #${ticket.id}`,
						description: 'This channel will be deleted in a few seconds.',
						footer: 'Priyx tickets',
					}),
				],
				flags: MessageFlags.IsComponentsV2,
			});
			await closeTicket(client, ticket, interaction.user.id, reason);
		}
	},
});
