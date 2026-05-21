import { MessageFlags } from 'discord.js';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import {
	isModuleName,
	replyWithGuildModulePanel,
} from '../../../src/utils/guildModulePanel';
import { errorEmbed } from '../../../src/utils/embed';

const handler: PriyxSelectMenuHandler = {
	customId: 'core:settings:module',
	addon: 'core',
	async execute(interaction, client) {
		const moduleName = interaction.values.at(0);
		if (!moduleName || !isModuleName(moduleName)) {
			await interaction.reply({
				embeds: [errorEmbed('Invalid module', 'That module is not configured.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await replyWithGuildModulePanel(interaction, client, moduleName);
	},
};

export default handler;
