import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { PriyxModalHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
	parseModuleConfigJson,
	replyWithGuildModulePanel,
} from '../../../src/utils/guildModulePanel';
import { errorEmbed, successEmbed } from '../../../src/utils/embed';
import {
	getTicketSetupDraft,
	makeTicketCategoryId,
	replyTicket,
	selectedTicketSetupCategory,
	ticketSetupContainer,
	updateTicketSetupDraftFromJson,
} from '../helpers';

const moduleName = 'ticket' as const satisfies ModuleName;

function optionalField(
	interaction: Parameters<PriyxModalHandler['execute']>[0],
	field: string,
): string {
	try {
		return interaction.fields.getTextInputValue(field).trim();
	} catch {
		return '';
	}
}

function uniqueCategoryId(categories: { id: string }[], label: string): string {
	const base = makeTicketCategoryId(label);
	let id = base;
	let suffix = 2;

	while (categories.some((category) => category.id === id)) {
		const suffixText = `-${suffix}`;
		id = `${base.slice(0, 80 - suffixText.length)}${suffixText}`;
		suffix += 1;
	}

	return id;
}

const handler: PriyxModalHandler = {
	customId: 'ticket:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [
					errorEmbed('Server only', 'Module settings are stored per server.'),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Missing permission',
						'You need Manage Server to change module settings.',
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (interaction.customId.startsWith('ticket:setup:modal:')) {
			const [, , , field, ownerId] = interaction.customId.split(':');
			if (ownerId !== interaction.user.id) {
				await replyTicket(
					interaction,
					'Setup locked',
					'Only the admin who opened this setup panel can submit it.',
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

			try {
				if (field === 'category-add' || field === 'category-edit') {
					const label = interaction.fields
						.getTextInputValue('label')
						.trim()
						.slice(0, 80);
					if (!label) {
						throw new Error('Button label is required.');
					}

					const description =
						optionalField(interaction, 'description').slice(0, 160) ||
						undefined;
					const emoji =
						optionalField(interaction, 'emoji').slice(0, 32) || undefined;

					if (field === 'category-add') {
						if (draft.categories.length >= 5) {
							throw new Error(
								'Button panels can show up to five ticket buttons.',
							);
						}

						const id = uniqueCategoryId(draft.categories, label);
						draft.categories.push({
							id,
							label,
							description,
							emoji,
						});
						draft.selectedCategoryId = id;
					} else {
						const selected = selectedTicketSetupCategory(draft);
						if (!selected) {
							throw new Error('Select a ticket button before editing it.');
						}

						selected.label = label;
						selected.description = description;
						selected.emoji = emoji;
						draft.selectedCategoryId = selected.id;
					}
				} else {
					const value = interaction.fields.getTextInputValue('value').trim();
					if (field === 'json') {
						updateTicketSetupDraftFromJson(draft, value);
					} else if (field === 'title') {
						draft.title = value.slice(0, 80) || undefined;
					} else if (field === 'description') {
						draft.description = value.slice(0, 1500) || undefined;
					} else if (field === 'color') {
						const color = value.startsWith('#') ? value : `#${value}`;
						if (!/^#[0-9a-f]{6}$/i.test(color)) {
							throw new Error('Use a hex color like #5865F2.');
						}
						draft.color = color;
					} else if (field === 'image') {
						draft.image = value || undefined;
					} else if (field === 'thumbnail') {
						draft.thumbnail = value || undefined;
					}
				}
			} catch (error) {
				await replyTicket(
					interaction,
					'Invalid setup value',
					error instanceof Error
						? error.message
						: 'The value could not be saved.',
				);
				return;
			}

			if (interaction.isFromMessage()) {
				await interaction.update({
					components: [
						ticketSetupContainer(
							draft,
							field === 'category-add' || field === 'category-edit'
								? 'categories'
								: 'edit',
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			await replyTicket(
				interaction,
				'Ticket setup updated',
				'The setup draft was updated.',
			);
			return;
		}

		if (interaction.customId !== 'ticket:modal') {
			return;
		}

		let rawConfig: string;
		try {
			rawConfig = interaction.fields.getTextInputValue('configJson');
		} catch {
			await replyWithGuildModulePanel(interaction, client, moduleName);
			return;
		}

		try {
			const config = parseModuleConfigJson(rawConfig);
			await client.updateGuildModuleConfig(
				interaction.guild.id,
				moduleName,
				config,
			);
			await interaction.reply({
				embeds: [
					successEmbed(
						'Module config updated',
						`Updated **${moduleName}** for this server.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Invalid config',
						error instanceof Error
							? error.message
							: 'Config JSON could not be parsed.',
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

export default handler;
