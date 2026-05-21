import { MessageFlags } from 'discord.js';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import { primaryEmbed, successEmbed } from '../../../src/utils/embed';
import { AiConversation } from '../database/models/AiConversation';

const handler: PriyxSelectMenuHandler = {
	customId: 'ai:panel',
	addon: 'ai',
	async execute(interaction, client) {
		const action = interaction.values[0];
		const guildId = interaction.guild?.id ?? 'dm';

		if (action === 'forget') {
			await AiConversation.destroy({
				where: { guildId, userId: interaction.user.id },
			});
			await client.cache.delete(`ai:history:${guildId}:${interaction.user.id}`);
			await interaction.reply({
				embeds: [successEmbed('AI history cleared', 'Your Priyx AI history was deleted.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const config = interaction.guild
			? await client.guildModule(interaction.guild.id, 'ai')
			: client.module('ai');
		const history =
			typeof config.history === 'object' &&
			config.history !== null &&
			!Array.isArray(config.history)
				? config.history
				: {};
		await interaction.reply({
			embeds: [
				primaryEmbed(
					'Priyx AI settings',
						[
							`Model: **${config.model ?? 'not configured'}**`,
							`Max tokens: **${config.maxTokens ?? 500}**`,
							`History TTL: **${Number(history.ttl ?? 3600)} seconds**`,
						].join('\n'),
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default handler;
