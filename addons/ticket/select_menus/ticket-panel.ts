import {
	MessageFlags,
	PermissionFlagsBits,
	type AnySelectMenuInteraction,
} from 'discord.js';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import type {
	ModuleName,
	TicketModuleConfig,
} from '../../../src/types/modules';
import {
	buildV2Container,
	componentsV2ReplyFlags,
	errorEmbed,
} from '../../../src/utils/embed';
import {
	createTicketChannel,
	ensureTicketMember,
	findTicketCategory,
	getTicketSetupDraft,
	replyTicket,
	selectedTicketSetupCategory,
	ticketCategories,
	ticketData,
	ticketSetupContainer,
} from '../helpers';

const moduleName = 'ticket' as const satisfies ModuleName;

function supportRoles(config: TicketModuleConfig): string {
	const roleIds = (config.supportRoles ?? []).filter(
		(roleId): roleId is string =>
			typeof roleId === 'string' && roleId.length > 0,
	);
	return roleIds.length > 0
		? roleIds.map((roleId) => `<@&${roleId}>`).join(', ')
		: 'Manage Channels / Manage Server';
}

function channelValue(id?: string): string {
	return id ? `<#${id}>` : 'Not set';
}

const handler: PriyxSelectMenuHandler = {
	customId: 'ticket:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction: AnySelectMenuInteraction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [
					errorEmbed('Server only', 'Ticket settings are stored per server.'),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const parts = interaction.customId.split(':');
		const action = parts[1];
		const config = await client.guildModule(interaction.guild.id, moduleName);

		if (action === 'open-select') {
			if (!interaction.isStringSelectMenu()) {
				await replyTicket(
					interaction,
					'Invalid ticket menu',
					'This ticket menu is no longer valid. Ask staff to post a fresh panel.',
				);
				return;
			}

			const member = await ensureTicketMember(interaction);
			if (!member) {
				return;
			}

			const category = findTicketCategory(config, interaction.values[0]);
			try {
				const ticket = await createTicketChannel(
					client,
					interaction.guild,
					member,
					config,
					category
						? `Panel type: ${category.label}`
						: 'Opened from ticket panel.',
					category,
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

		if (action === 'setup') {
			const setupAction = parts[2] ?? '';
			const ownerId = parts[3];
			if (ownerId !== interaction.user.id) {
				await replyTicket(
					interaction,
					'Setup locked',
					'Only the admin who opened this setup panel can use these controls.',
				);
				return;
			}

			if (
				!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
			) {
				await replyTicket(
					interaction,
					'Missing permission',
					'You need Manage Server to configure tickets.',
				);
				return;
			}

			const draft = getTicketSetupDraft(
				interaction.guild.id,
				interaction.user.id,
			);
			if (!draft) {
				await replyTicket(
					interaction,
					'Setup expired',
					'Run `/ticket setup` again to start a fresh setup panel.',
				);
				return;
			}

			if (
				setupAction === 'panel-channel' &&
				interaction.isChannelSelectMenu()
			) {
				draft.panelChannelId = interaction.values[0];
			} else if (
				setupAction === 'ticket-category' &&
				interaction.isChannelSelectMenu()
			) {
				draft.ticketCategoryId = interaction.values[0];
			} else if (
				setupAction === 'category-select' &&
				interaction.isStringSelectMenu()
			) {
				const selectedId = interaction.values[0];
				if (selectedId !== 'none') {
					draft.selectedCategoryId = selectedId;
				}
				await interaction.update({
					components: [ticketSetupContainer(draft, 'categories')],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			} else if (
				setupAction === 'category-target' &&
				interaction.isChannelSelectMenu()
			) {
				const selected = selectedTicketSetupCategory(draft);
				if (!selected) {
					await replyTicket(
						interaction,
						'No button selected',
						'Add a ticket button before selecting its Discord category.',
					);
					return;
				}
				selected.channelId = interaction.values[0] || undefined;
				await interaction.update({
					components: [ticketSetupContainer(draft, 'categories')],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			} else if (
				setupAction === 'support-role' &&
				interaction.isRoleSelectMenu()
			) {
				draft.supportRoleIds = interaction.values[0]
					? [interaction.values[0]]
					: [];
			} else {
				await replyTicket(
					interaction,
					'Invalid setup selector',
					'Run `/ticket setup` again if this selector is old.',
				);
				return;
			}

			await interaction.update({
				components: [ticketSetupContainer(draft, true)],
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		if (action !== 'panel') {
			await replyTicket(
				interaction,
				'Unknown ticket menu',
				'This ticket menu is no longer active. Run `/ticket setup` to post a fresh panel.',
			);
			return;
		}

		const categories = ticketCategories(config);
		const enabled = await client.isGuildModuleEnabled(
			interaction.guild.id,
			moduleName,
		);

		await interaction.reply({
			components: [
				buildV2Container({
					title: 'Ticket Setup',
					description: [
						`Enabled: **${enabled ? 'true' : 'false'}**`,
						`Ticket category: **${channelValue(config.category)}**`,
						`Transcript channel: **${channelValue(config.transcriptChannel)}**`,
						`Log channel: **${channelValue(config.logChannel)}**`,
						`Support access: **${supportRoles(config)}**`,
						`Max open per user: **${config.maxOpenPerUser ?? 1}**`,
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
						'Use `/ticket setup` to post a panel or change these settings.',
					].join('\n'),
					footer: 'Priyx tickets',
				}),
			],
			flags: componentsV2ReplyFlags(true),
		});
	},
};

export default handler;
