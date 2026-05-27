import type { PriyxModalHandler } from '../../../src/types/addon';
import { errorEmbed, primaryEmbed } from '../../../src/utils/embed';
import { formatAiReply, runAiChat } from '../helpers/chat';

const handler: PriyxModalHandler = {
	customId: 'ai:chat-modal',
	addon: 'ai',
	async execute(interaction, client) {
		await interaction.deferReply();

		const guildId = interaction.guild?.id ?? 'dm';
		const config = interaction.guild
			? await client.guildModule(guildId, 'ai')
			: client.module('ai');
		const prompt = interaction.fields.getTextInputValue('prompt');

		try {
			const reply = await runAiChat({
				client,
				config,
				guildId,
				prompt,
				userId: interaction.user.id,
			});

			await interaction.editReply({
				embeds: [primaryEmbed('Priyx AI', formatAiReply(reply))],
			});
		} catch (error) {
			client.logger.error('[ai] Modal request failed:', error);
			await interaction.editReply({
				embeds: [
					errorEmbed(
						'AI unavailable',
						error instanceof Error ? error.message : 'The configured AI provider failed.',
					),
				],
			});
		}
	},
};

export default handler;
