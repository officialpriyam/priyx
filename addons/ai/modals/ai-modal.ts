import type { PriyxModalHandler } from '../../../src/types/addon';
import { errorEmbed, primaryEmbed } from '../../../src/utils/embed';
import { AiConversation, type AiStoredMessage } from '../database/models/AiConversation';
import { completeChat } from '../helpers/openai';

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
			const [conversation] = await AiConversation.findOrCreate({
				where: { guildId, userId: interaction.user.id },
				defaults: { guildId, userId: interaction.user.id, messages: [] },
			});
			const existingMessages = (conversation.messages ?? []) as AiStoredMessage[];
			const reply = await completeChat({
				model: config.model ?? 'gpt-4o-mini',
				systemPrompt: config.systemPrompt ?? 'You are Priyx, a helpful Discord assistant.',
				maxTokens: config.maxTokens ?? 500,
				messages: existingMessages,
				prompt,
			});

			conversation.messages = [
				...existingMessages,
				{ role: 'user' as const, content: prompt, at: Date.now() },
				{ role: 'assistant' as const, content: reply, at: Date.now() },
			].slice(-20);
			await conversation.save();

			await interaction.editReply({
				embeds: [primaryEmbed('Priyx AI', reply)],
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
