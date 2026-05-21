import { ChannelType, Events, type VoiceState } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.VoiceStateUpdate,
	addon: 'tempvoice',
	async execute(client, oldState: VoiceState, newState: VoiceState) {
		const config = await client.guildModule(newState.guild.id, 'tempvoice');
		if (!config.createChannel || newState.channelId !== config.createChannel) {
			return;
		}

		const member = newState.member;
		if (!member) {
			return;
		}

		const channel = await newState.guild.channels.create({
			name: (config.defaultName ?? "{username}'s Channel").replace(
				'{username}',
				member.user.username,
			),
			type: ChannelType.GuildVoice,
			parent: config.category || undefined,
			userLimit: config.defaultLimit ?? 0,
			bitrate: config.allowedBitrate ?? undefined,
		});

		await member.voice.setChannel(channel).catch(() => undefined);
		await client.cache.set(
			`tempvoice:owner:${channel.id}`,
			member.id,
			client.module('bot').redis.ttl.userdata,
		);

		if (oldState.channelId) {
			client.logger.debug(`[tempvoice] moved from ${oldState.channelId}`);
		}
	},
});
