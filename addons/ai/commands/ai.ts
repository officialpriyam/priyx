import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import { buttonRow, primaryButton, selectRow, stringSelect } from '../../../src/utils/components';
import { errorEmbed, primaryEmbed, successEmbed } from '../../../src/utils/embed';
import { AiConversation, type AiStoredMessage } from '../database/models/AiConversation';
import { completeChat } from '../helpers/openai';

function historyLimit(value: unknown): number {
	if (typeof value === 'object' && value !== null && 'maxMessages' in value) {
		return Number(value.maxMessages ?? 20);
	}

	return 20;
}

function historyTtl(value: unknown): number {
	if (typeof value === 'object' && value !== null && 'ttl' in value) {
		return Number(value.ttl ?? 3600);
	}

	return 3600;
}

async function getConversation(guildId: string, userId: string): Promise<AiConversation> {
	const [conversation] = await AiConversation.findOrCreate({
		where: { guildId, userId },
		defaults: { guildId, userId, messages: [] },
	});
	return conversation;
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('ai')
		.setDescription('Chat with Priyx AI tools.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('chat')
				.setDescription('Send a prompt to the configured AI model.')
				.addStringOption((option) =>
					option
						.setName('prompt')
						.setDescription('What should Priyx answer?')
						.setRequired(true)
						.setMaxLength(1500),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('translate')
				.setDescription('Translate text with the configured AI model.')
				.addStringOption((option) =>
					option
						.setName('text')
						.setDescription('Text to translate.')
						.setRequired(true)
						.setMaxLength(1500),
				)
				.addStringOption((option) =>
					option
						.setName('language')
						.setDescription('Target language, for example Hindi, English, Spanish.')
						.setRequired(true)
						.setMaxLength(50),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('forget').setDescription('Delete your cached AI conversation history.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('personality').setDescription('Show configured AI model settings.'),
		),
	category: 'ai',
	addon: 'ai',
	cooldown: 5,
	async execute(interaction, client) {
		const subcommand = interaction.options.getSubcommand(true);
		const guildId = interaction.guild?.id ?? 'dm';
		const config = interaction.guild
			? await client.guildModule(guildId, 'ai')
			: client.module('ai');

		if (subcommand === 'forget') {
			await AiConversation.destroy({
				where: { guildId, userId: interaction.user.id },
			});
			await client.cache.delete(`ai:history:${guildId}:${interaction.user.id}`);
			await interaction.reply({
				embeds: [successEmbed('AI history cleared', 'Your Priyx AI conversation history was deleted.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'personality') {
			await interaction.reply({
				embeds: [
					primaryEmbed(
						'Priyx AI settings',
						[
							`Model: **${config.model ?? 'not configured'}**`,
							`Max tokens: **${config.maxTokens ?? 500}**`,
							`System prompt: ${config.systemPrompt ?? 'not configured'}`,
						].join('\n'),
					),
				],
				components: [
					selectRow(
						stringSelect('ai:panel', 'AI action', [
							{ label: 'Show settings', value: 'settings', description: 'View active AI settings' },
							{ label: 'Clear history', value: 'forget', description: 'Delete your AI history' },
						]),
					),
					buttonRow(primaryButton('ai:open-chat', 'Open chat modal')),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply();

		try {
			const conversation = await getConversation(guildId, interaction.user.id);
			const existingMessages = (conversation.messages ?? []) as AiStoredMessage[];
			const prompt =
				subcommand === 'translate'
					? `Translate this text to ${interaction.options.getString('language', true)}. Return only the translation.\n\n${interaction.options.getString('text', true)}`
					: interaction.options.getString('prompt', true);

			const reply = await completeChat({
				model: config.model ?? 'gpt-4o-mini',
				systemPrompt: config.systemPrompt ?? 'You are Priyx, a helpful Discord assistant.',
				maxTokens: config.maxTokens ?? 500,
				messages: existingMessages,
				prompt,
			});

			const nextMessages: AiStoredMessage[] = [
				...existingMessages,
				{ role: 'user' as const, content: prompt, at: Date.now() },
				{ role: 'assistant' as const, content: reply, at: Date.now() },
			].slice(-historyLimit(config.history));

			conversation.messages = nextMessages;
			await conversation.save();
			await client.cache.set(
				`ai:history:${guildId}:${interaction.user.id}`,
				nextMessages,
				historyTtl(config.history),
			);

			await interaction.editReply({
				embeds: [primaryEmbed(subcommand === 'translate' ? 'Translation' : 'Priyx AI', reply)],
			});
		} catch (error) {
			client.logger.error('[ai] AI request failed:', error);
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
});
