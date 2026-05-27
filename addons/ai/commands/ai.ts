import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import { buttonRow, primaryButton, selectRow, stringSelect } from '../../../src/utils/components';
import { errorEmbed, primaryEmbed, successEmbed } from '../../../src/utils/embed';
import { aiSettingsDescription, forgetAiHistory, formatAiReply, runAiChat } from '../helpers/chat';

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
			await forgetAiHistory(client, guildId, interaction.user.id);
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
						aiSettingsDescription(config),
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
			const prompt =
				subcommand === 'translate'
					? `Translate this text to ${interaction.options.getString('language', true)}. Return only the translation.\n\n${interaction.options.getString('text', true)}`
					: interaction.options.getString('prompt', true);

			const reply = await runAiChat({
				client,
				config,
				guildId,
				includeKnowledge: subcommand !== 'translate',
				prompt,
				userId: interaction.user.id,
			});

			await interaction.editReply({
				embeds: [primaryEmbed(subcommand === 'translate' ? 'Translation' : 'Priyx AI', formatAiReply(reply))],
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
