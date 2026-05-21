import {
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	TextInputStyle,
	type TextBasedChannel,
} from 'discord.js';
import type { PriyxButtonHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import { buildModal } from '../../../src/utils/components';
import {
	buildV2Container,
	componentsV2ReplyFlags,
} from '../../../src/utils/embed';
import { updateGuildModuleEnabled } from '../../../src/utils/guildModulePanel';
import { Ticket } from '../database/models/Ticket';
import {
	closeTicket,
	createTicketChannel,
	deleteTicketSetupDraft,
	ensureTicketMember,
	findTicketById,
	findTicketCategory,
	getTicketSetupDraft,
	isTicketStaff,
	panelContainer,
	replyTicket,
	sendTranscript,
	selectedTicketSetupCategory,
	ticketActionRows,
	ticketData,
	ticketSetupContainer,
	ticketSetupPatchFromDraft,
} from '../helpers';

const moduleName = 'ticket' as const satisfies ModuleName;

interface PanelChannel {
	id: string;
	send(payload: unknown): Promise<{ id: string }>;
	type?: ChannelType;
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

function ticketIdFrom(parts: string[]): number | null {
	const ticketId = Number(parts[2]);
	return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
}

function setupModal(action: string, userId: string) {
	if (action === 'category-add' || action === 'category-edit') {
		const editing = action === 'category-edit';
		return buildModal(
			`ticket:setup:modal:${action}:${userId}`,
			editing ? 'Edit Ticket Button' : 'Add Ticket Button',
			[
				{
					customId: 'label',
					label: 'Button or option label',
					maxLength: 80,
					placeholder: 'General Support',
				},
				{
					customId: 'description',
					label: 'Description',
					style: TextInputStyle.Paragraph,
					required: false,
					maxLength: 160,
					placeholder: 'Get help with general issues',
				},
				{
					customId: 'emoji',
					label: 'Emoji',
					required: false,
					maxLength: 32,
					placeholder: 'Paste a Unicode or custom emoji',
				},
			],
		);
	}

	const common = {
		customId: 'value',
		required: action !== 'image' && action !== 'thumbnail',
	};

	if (action === 'description') {
		return buildModal(
			`ticket:setup:modal:${action}:${userId}`,
			'Panel Description',
			[
				{
					...common,
					label: 'Description',
					style: TextInputStyle.Paragraph,
					maxLength: 1500,
					placeholder: 'Press a button below to open a ticket.',
				},
			],
		);
	}

	if (action === 'json') {
		return buildModal(`ticket:setup:modal:${action}:${userId}`, 'Panel JSON', [
			{
				...common,
				label: 'Panel JSON',
				style: TextInputStyle.Paragraph,
				maxLength: 3000,
				placeholder:
					'{"title":"Support","description":"Choose a category","color":"#6C63FF","categories":[{"id":"support","label":"Support","channelId":"123"}]}',
			},
		]);
	}

	const labels: Record<string, string> = {
		title: 'Title',
		color: 'Hex Color',
		image: 'Image URL',
		thumbnail: 'Thumbnail URL',
	};

	return buildModal(
		`ticket:setup:modal:${action}:${userId}`,
		`Panel ${labels[action] ?? 'Field'}`,
		[
			{
				...common,
				label: labels[action] ?? 'Value',
				maxLength: action === 'title' ? 80 : 300,
				placeholder:
					action === 'color'
						? '#6C63FF'
						: action === 'title'
							? 'Support Tickets'
							: 'https://example.com/image.png',
			},
		],
	);
}

const handler: PriyxButtonHandler = {
	customId: 'ticket:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		const parts = interaction.customId.split(':');
		const action = parts[1];

		if (action === 'settings') {
			const settingAction = parts[2];
			if (settingAction === 'enable') {
				await updateGuildModuleEnabled(interaction, client, moduleName, true);
				return;
			}

			if (settingAction === 'disable') {
				await updateGuildModuleEnabled(interaction, client, moduleName, false);
				return;
			}

			await replyTicket(
				interaction,
				'Ticket Setup',
				'Use `/ticket setup` to post a panel and save this server setup. Use `/ticket config` to view it in a readable format.',
			);
			return;
		}

		if (!interaction.guild) {
			await replyTicket(
				interaction,
				'Server only',
				'Tickets can only be used in a server.',
			);
			return;
		}

		const config = await client.guildModule(interaction.guild.id, moduleName);

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
				[
					'title',
					'description',
					'color',
					'image',
					'thumbnail',
					'json',
					'category-add',
					'category-edit',
				].includes(setupAction)
			) {
				if (setupAction === 'category-add' && draft.categories.length >= 5) {
					await replyTicket(
						interaction,
						'Button limit reached',
						'Button panels can show up to five ticket buttons. Remove one before adding another.',
					);
					return;
				}

				if (
					setupAction === 'category-edit' &&
					!selectedTicketSetupCategory(draft)
				) {
					await replyTicket(
						interaction,
						'Select a button',
						'Open Buttons, add or select a ticket button, then edit it.',
					);
					return;
				}

				await interaction.showModal(
					setupModal(setupAction, interaction.user.id),
				);
				return;
			}

			if (setupAction === 'categories') {
				await interaction.update({
					components: [ticketSetupContainer(draft, 'categories')],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			if (setupAction === 'category-remove') {
				const selected = selectedTicketSetupCategory(draft);
				if (!selected) {
					await replyTicket(
						interaction,
						'No button selected',
						'Add a ticket button before removing one.',
					);
					return;
				}

				draft.categories = draft.categories.filter(
					(category) => category.id !== selected.id,
				);
				draft.selectedCategoryId = draft.categories[0]?.id;
				await interaction.update({
					components: [ticketSetupContainer(draft, 'categories')],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			if (setupAction === 'target') {
				await interaction.update({
					components: [ticketSetupContainer(draft, true)],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			if (setupAction === 'back') {
				await interaction.update({
					components: [ticketSetupContainer(draft)],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			if (setupAction === 'exit') {
				deleteTicketSetupDraft(interaction.guild.id, interaction.user.id);
				await interaction.update({
					components: [
						buildV2Container({
							title: 'Ticket Setup Closed',
							description: 'No ticket panel was posted.',
							footer: 'Priyx tickets',
						}),
					],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			if (setupAction === 'save') {
				const targetChannel = draft.panelChannelId
					? await interaction.guild.channels
							.fetch(draft.panelChannelId)
							.catch(() => null)
					: interaction.channel;
				if (!isPanelChannel(targetChannel)) {
					await replyTicket(
						interaction,
						'Select panel channel',
						'Choose a normal text or announcement channel before saving.',
					);
					return;
				}

				await interaction.deferUpdate();
				const patch = ticketSetupPatchFromDraft(draft);
				await client.updateGuildModuleConfig(
					interaction.guild.id,
					moduleName,
					patch,
				);
				await client.setGuildModuleEnabled(
					interaction.guild.id,
					moduleName,
					true,
				);
				const effectiveConfig = {
					...config,
					...patch,
					enabled: true,
				};
				const panelMessage = await targetChannel.send({
					components: [panelContainer(effectiveConfig)],
					flags: MessageFlags.IsComponentsV2,
				});

				await Ticket.create({
					guildId: interaction.guild.id,
					userId: null,
					data: {
						type: 'panel',
						panelChannelId: targetChannel.id,
						panelMessageId: panelMessage.id,
						title: draft.title,
						description: draft.description,
						panelStyle: draft.categoryType,
						color: draft.color,
						image: draft.image,
						thumbnail: draft.thumbnail,
					},
				});

				deleteTicketSetupDraft(interaction.guild.id, interaction.user.id);
				await interaction.editReply({
					components: [
						buildV2Container({
							title: 'Ticket Panel Posted',
							description: [
								`Panel posted in <#${targetChannel.id}>.`,
								`Panel type: **${draft.categoryType === 'select' ? 'Select Menu' : 'Button'}**`,
								draft.ticketCategoryId
									? `Ticket category: **<#${draft.ticketCategoryId}>**`
									: 'Ticket category: **Not set**',
								'Use `/ticket panel` later to post another panel with these saved settings.',
							].join('\n'),
							footer: 'Priyx tickets',
						}),
					],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			await replyTicket(
				interaction,
				'Unknown setup action',
				'Run `/ticket setup` again if this setup panel is old.',
			);
			return;
		}

		if (action === 'open') {
			const member = await ensureTicketMember(interaction);
			if (!member) {
				return;
			}

			const category = findTicketCategory(config, parts[2]);
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

		const ticketId = ticketIdFrom(parts);
		if (!ticketId) {
			await replyTicket(
				interaction,
				'Invalid ticket action',
				'This ticket button is missing a valid ticket id.',
			);
			return;
		}

		const ticket = await findTicketById(interaction.guild.id, ticketId);
		if (!ticket || ticketData(ticket).status !== 'open') {
			await replyTicket(
				interaction,
				'Ticket unavailable',
				'This ticket is already closed or no longer exists.',
			);
			return;
		}

		const member = await ensureTicketMember(interaction);
		if (!member) {
			return;
		}

		const data = ticketData(ticket);
		const staff = await isTicketStaff(member, config);
		const owner = ticket.userId === interaction.user.id;

		if (action === 'claim') {
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

			await interaction.message
				.edit({
					components: [
						buildV2Container({
							title: `Ticket #${ticket.id}`,
							description: [
								ticket.userId ? `Owner: <@${ticket.userId}>` : undefined,
								data.categoryLabel ? `Type: ${data.categoryLabel}` : undefined,
								`Claimed by: <@${interaction.user.id}>`,
								`Reason: ${data.reason ?? 'No reason provided.'}`,
							]
								.filter(Boolean)
								.join('\n'),
							actionRows: ticketActionRows(ticket.id, true),
							footer: 'Priyx tickets',
						}),
					],
					flags: MessageFlags.IsComponentsV2,
				})
				.catch(() => undefined);

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

		if (action === 'transcript') {
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
			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Transcript Created',
						description:
							config.transcriptChannel || config.logChannel
								? 'The transcript was sent to the configured transcript/log channel.'
								: 'The transcript was sent in this ticket channel.',
						footer: 'Priyx tickets',
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		if (action === 'close') {
			if (!staff && !owner) {
				await replyTicket(
					interaction,
					'Missing permission',
					'Only the ticket owner or ticket staff can close this ticket.',
				);
				return;
			}

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
			await closeTicket(
				client,
				ticket,
				interaction.user.id,
				'Closed from ticket button.',
			);
			return;
		}

		await replyTicket(
			interaction,
			'Unknown ticket action',
			'This ticket button is not supported anymore. Run `/ticket setup` to post a fresh panel.',
		);
	},
};

export default handler;
