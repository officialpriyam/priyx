import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import {
	createOrGetMusicPlayer,
	ensureMusicPlayback,
	formatTrack,
	isMusicIdAllowed,
	setupRainlink,
	updateLivePlayer,
} from '../helpers';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'music',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		const config = await client.guildModule(message.guild.id, 'music');
		const songRequests = isRecord(config.songRequests) ? config.songRequests : {};
		const channelId = String(songRequests.channel ?? '').trim();
		const prompt = message.content.trim();
		if (
			songRequests.enabled !== true ||
			!channelId ||
			message.channel.id !== channelId ||
			!prompt ||
			prompt.startsWith(client.module('bot').prefix)
		) {
			return;
		}

		const member = await message.guild.members.fetch(message.author.id).catch(() => null);
		if (!member?.voice.channel) {
			await message
				.reply({
					content: 'Join a voice channel before requesting music.',
					allowedMentions: { repliedUser: false },
				})
				.catch(() => undefined);
			return;
		}

		if (!isMusicIdAllowed(config.allowedVoiceChannels, member.voice.channelId)) {
			await message
				.reply({
					content: 'Music playback is limited to selected voice channels in this server.',
					allowedMentions: { repliedUser: false },
				})
				.catch(() => undefined);
			return;
		}

		setupRainlink(client);
		if (!client.rainlink) {
			await message
				.reply({
					content: 'Music is not available because no Lavalink node is configured.',
					allowedMentions: { repliedUser: false },
				})
				.catch(() => undefined);
			return;
		}

		try {
			const player = await createOrGetMusicPlayer(
				client,
				message.guild,
				message.channel.id,
				member.voice.channel,
				config,
			);
			const result = await client.rainlink.search(prompt, {
				requester: message.author,
				engine: String(config.searchEngine ?? 'youtube'),
			});
			const track = result.tracks[0];
			if (!track) {
				await message
					.reply({
						content: 'No playable tracks were found.',
						allowedMentions: { repliedUser: false },
					})
					.catch(() => undefined);
				return;
			}

			const maxQueueSize = Number(config.maxQueueSize ?? 500);
			if (player.queue.totalSize >= maxQueueSize) {
				await message
					.reply({
						content: `This server queue is limited to ${maxQueueSize} tracks.`,
						allowedMentions: { repliedUser: false },
					})
					.catch(() => undefined);
				return;
			}

			player.queue.add(track);
			if (config.autoShuffle && player.queue.size > 1) {
				player.queue.shuffle();
			}
			await ensureMusicPlayback(player);
			await updateLivePlayer(client, player).catch(() => undefined);
			await message
				.reply({
					content: `Queued ${formatTrack(track)}`,
					allowedMentions: { parse: [], repliedUser: false },
				})
				.catch(() => undefined);
		} catch (error) {
			client.addonLogger('music').error('Song request failed:', error);
			await message
				.reply({
					content: error instanceof Error ? error.message : 'Music request failed.',
					allowedMentions: { repliedUser: false },
				})
				.catch(() => undefined);
		}
	},
});
