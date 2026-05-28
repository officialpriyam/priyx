import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import { errorEmbed } from '../../../src/utils/embed';
import { aiReplyPayload, runAiChat } from '../helpers/chat';

function canSendTyping(
	channel: Message['channel'],
): channel is Message['channel'] & { sendTyping: () => Promise<void> } {
	return 'sendTyping' in channel && typeof channel.sendTyping === 'function';
}

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'ai',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		const config = await client.guildModule(message.guild.id, 'ai');
		const supportChannel = String(config.supportChannel ?? '').trim();
		const prompt = message.content.trim();
		if (
			!supportChannel ||
			message.channel.id !== supportChannel ||
			!prompt ||
			prompt.startsWith(client.module('bot').prefix)
		) {
			return;
		}

		if (canSendTyping(message.channel)) {
			await message.channel.sendTyping().catch(() => undefined);
		}

		try {
			const reply = await runAiChat({
				client,
				config,
				guildId: message.guild.id,
				prompt,
				userId: message.author.id,
			});

			await message.reply({
				allowedMentions: { parse: [], repliedUser: false },
				...aiReplyPayload('Priyx AI Support', reply, config),
			});
		} catch (error) {
			client.logger.error('[ai] Support channel request failed:', error);
			await message.reply({
				allowedMentions: { repliedUser: false },
				embeds: [
					errorEmbed(
						'AI unavailable',
						error instanceof Error ? error.message : 'The configured AI provider failed.',
					),
				],
			}).catch(() => undefined);
		}
	},
});
