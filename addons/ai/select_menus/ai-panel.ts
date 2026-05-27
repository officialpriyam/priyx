import { MessageFlags } from 'discord.js';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import { primaryEmbed, successEmbed } from '../../../src/utils/embed';
import { aiSettingsDescription, forgetAiHistory } from '../helpers/chat';

const handler: PriyxSelectMenuHandler = {
	customId: 'ai:panel',
	addon: 'ai',
	async execute(interaction, client) {
		const action = interaction.values[0];
		const guildId = interaction.guild?.id ?? 'dm';

		if (action === 'forget') {
			await forgetAiHistory(client, guildId, interaction.user.id);
			await interaction.reply({
				embeds: [successEmbed('AI history cleared', 'Your Priyx AI history was deleted.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const config = interaction.guild
			? await client.guildModule(interaction.guild.id, 'ai')
			: client.module('ai');
		await interaction.reply({
			embeds: [
				primaryEmbed(
					'Priyx AI settings',
					aiSettingsDescription(config),
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default handler;
