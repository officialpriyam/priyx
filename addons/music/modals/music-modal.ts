import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { PriyxModalHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
	parseModuleConfigJson,
	replyWithGuildModulePanel,
} from '../../../src/utils/guildModulePanel';
import { errorEmbed, successEmbed } from '../../../src/utils/embed';

const moduleName = 'music' as const satisfies ModuleName;

const handler: PriyxModalHandler = {
	customId: 'music:modal',
	addon: moduleName,
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [errorEmbed('Server only', 'Module settings are stored per server.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
			await interaction.reply({
				embeds: [
					errorEmbed('Missing permission', 'You need Manage Server to change module settings.'),
				],
				flags: MessageFlags.Ephemeral,
			});
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
			await client.updateGuildModuleConfig(interaction.guild.id, moduleName, config);
			await interaction.reply({
				embeds: [successEmbed('Module config updated', `Updated **${moduleName}** for this server.`)],
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			await interaction.reply({
				embeds: [
					errorEmbed(
						'Invalid config',
						error instanceof Error ? error.message : 'Config JSON could not be parsed.',
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

export default handler;
