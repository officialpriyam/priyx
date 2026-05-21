import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { PriyxButtonHandler } from '../../../src/types/addon';
import { errorEmbed, successEmbed } from '../../../src/utils/embed';
import { AutoReactRule } from '../database/models/AutoReactRule';

const handler: PriyxButtonHandler = {
	customId: 'autoreact:delete:',
	addon: 'autoreact',
	match: 'prefix',
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [errorEmbed('Server only', 'Autoreact rules are server-scoped.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
			await interaction.reply({
				embeds: [errorEmbed('Missing permission', 'You need Manage Server to delete autoreact rules.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const id = Number(interaction.customId.replace('autoreact:delete:', ''));
		if (!Number.isInteger(id)) {
			await interaction.reply({
				embeds: [errorEmbed('Invalid rule', 'The autoreact rule ID is invalid.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const deleted = await AutoReactRule.destroy({
			where: { id, guildId: interaction.guild.id },
		});
		await client.cache.delete(`autoreact:rules:${interaction.guild.id}`);

		await interaction.reply({
			embeds: [
				deleted > 0
					? successEmbed('Autoreact rule deleted', `Deleted rule **${id}**.`)
					: errorEmbed('Rule not found', `No autoreact rule exists with ID **${id}**.`),
			],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default handler;
