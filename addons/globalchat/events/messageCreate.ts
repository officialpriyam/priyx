import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import { truncate } from '../../../src/utils/string';
import { GlobalChatBridge } from '../database/models/GlobalChatBridge';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function bridgeChannelId(bridge: GlobalChatBridge): string {
	return isRecord(bridge.data) ? stringValue(bridge.data.channelId) : '';
}

function hasBlockedWord(content: string, words: string[]): boolean {
	const normalized = content.toLowerCase();
	return words.some((word) => word && normalized.includes(word.toLowerCase()));
}

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'globalchat',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		const config = await client.guildModule(message.guild.id, 'globalchat');
		const sourceChannelId = stringValue(config.channel);
		if (!sourceChannelId || message.channel.id !== sourceChannelId) {
			return;
		}

		const bannedWords = stringList(config.bannedWords);
		if (
			config.filterProfanity !== false &&
			hasBlockedWord(message.content, bannedWords)
		) {
			return;
		}

		const maxLength = numberValue(config.maxMessageLength, 1800);
		const includeAttachments = config.attachments !== false;
		const attachmentUrls = includeAttachments
			? [...message.attachments.values()].map((attachment) => attachment.url)
			: [];
		const body = [
			`**${message.member?.displayName ?? message.author.username}** from **${message.guild.name}**`,
			truncate(message.content || '*No text content*', maxLength),
			...attachmentUrls.slice(0, 3),
		].join('\n');
		const bridges = await GlobalChatBridge.findAll();

		for (const bridge of bridges) {
			if (bridge.guildId === message.guild.id) {
				continue;
			}

			if (!(await client.isGuildModuleEnabled(bridge.guildId, 'globalchat'))) {
				continue;
			}

			const targetConfig = await client.guildModule(
				bridge.guildId,
				'globalchat',
			);
			const channelId =
				stringValue(targetConfig.channel) || bridgeChannelId(bridge);
			if (!channelId) {
				continue;
			}

			const targetGuild = client.guilds.cache.get(bridge.guildId);
			const targetChannel = await targetGuild?.channels
				.fetch(channelId)
				.catch(() => null);

			if (!targetChannel?.isTextBased() || targetChannel.isDMBased()) {
				continue;
			}

			await targetChannel
				.send({ content: body, allowedMentions: { parse: [] } })
				.catch(() => undefined);
		}
	},
});
