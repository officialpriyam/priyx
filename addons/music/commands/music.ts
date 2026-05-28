import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type GuildMember,
} from 'discord.js';
import { RainlinkLoopMode, type RainlinkFilterMode } from 'rainlink';
import type { PriyxClient } from '../../../src/client';
import { PriyxCommand } from '../../../src/structures/Command';
import type { MusicModuleConfig } from '../../../src/types/modules';
import { componentsV2ReplyFlags } from '../../../src/utils/embed';
import {
	applyMusicFilter,
	buildQueueContainer,
	createOrGetMusicPlayer,
	cycleLoop,
	ensureMusicPlayback,
	endLivePlayer,
	formatTrack,
	formatTrackDuration,
	getMusicPlayer,
	getMusicState,
	hasControlPermission,
	isMusicCommandEnabled,
	isMusicIdAllowed,
	musicNodeStatus,
	musicPlayerStatus,
	musicFilters,
	parseSeekTime,
	repairMusicPlayer,
	replyMusic,
	requireSameVoice,
	setupRainlink,
	updateLivePlayer,
} from '../helpers';

async function requireRainlink(
	client: PriyxClient,
): Promise<NonNullable<PriyxClient['rainlink']>> {
	setupRainlink(client);
	if (!client.rainlink) {
		throw new Error(
			'Rainlink is not configured. Add at least one Lavalink node in modules.yml.',
		);
	}

	return client.rainlink;
}

async function requireGuild(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) {
		await replyMusic(
			interaction,
			interaction.client as PriyxClient,
			'Server only',
			'Music playback is server-scoped.',
			true,
		);
		return null;
	}

	return interaction.guild;
}

async function requireMemberVoice(
	interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
	const guild = interaction.guild;
	if (!guild) {
		return null;
	}

	const member = await guild.members
		.fetch(interaction.user.id)
		.catch(() => null);
	if (!member?.voice.channel) {
		await replyMusic(
			interaction,
			interaction.client as PriyxClient,
			'Join a voice channel',
			'You need to be in a voice channel before using music commands.',
			true,
		);
		return null;
	}

	return member;
}

async function requireAllowedVoice(
	interaction: ChatInputCommandInteraction,
	client: PriyxClient,
	member: GuildMember,
	config: MusicModuleConfig,
): Promise<boolean> {
	if (isMusicIdAllowed(config.allowedVoiceChannels, member.voice.channelId)) {
		return true;
	}

	await replyMusic(
		interaction,
		client,
		'Voice channel not allowed',
		'Music playback is limited to selected voice channels in this server.',
		true,
	);
	return false;
}

async function requirePlayer(
	interaction: ChatInputCommandInteraction,
	client: PriyxClient,
) {
	if (!interaction.guild) {
		return null;
	}

	const player = getMusicPlayer(client, interaction.guild.id);
	if (!player) {
		await replyMusic(
			interaction,
			client,
			'Nothing playing',
			'No active music player exists in this server.',
			true,
		);
		return null;
	}

	return player;
}

async function requireControl(
	interaction: ChatInputCommandInteraction,
	client: PriyxClient,
): Promise<boolean> {
	if (!interaction.guild) {
		return false;
	}

	const player = getMusicPlayer(client, interaction.guild.id);
	if (!player) {
		return false;
	}

	const config = await client.guildModule(interaction.guild.id, 'music');
	if (!(await requireSameVoice(interaction, player))) {
		return false;
	}

	if (await hasControlPermission(interaction, player, config)) {
		return true;
	}

	await replyMusic(
		interaction,
		client,
		'Missing permission',
		'Only the requester, a DJ role, or a server manager can control this player.',
		true,
	);
	return false;
}

function loopModeFrom(value: string): RainlinkLoopMode {
	if (value === 'track' || value === 'song') {
		return RainlinkLoopMode.SONG;
	}

	if (value === 'queue') {
		return RainlinkLoopMode.QUEUE;
	}

	return RainlinkLoopMode.NONE;
}

const filterChoices = musicFilters.map((filter) => ({
	name: filter.label,
	value: filter.value,
}));

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('music')
		.setDescription(
			'Play music with a live player, filters, queue, and controls.',
		)
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('play')
				.setDescription('Search and queue a track or playlist.')
				.addStringOption((option) =>
					option
						.setName('query')
						.setDescription('Track name, search terms, or URL.')
						.setRequired(true)
						.setMaxLength(500),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('join').setDescription('Join your voice channel.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('leave')
				.setDescription('Leave voice and destroy the player.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('queue').setDescription('Show the current queue.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('nowplaying').setDescription('Show the live player.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('status')
				.setDescription('Show Lavalink node and player diagnostics.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('repair')
				.setDescription('Reconnect the voice player and restore the queue.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('previous').setDescription('Play the previous track.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('skip').setDescription('Skip the current track.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('pause').setDescription('Pause playback.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('resume').setDescription('Resume playback.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('shuffle').setDescription('Shuffle the queue.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('clear').setDescription('Clear upcoming tracks.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('remove')
				.setDescription('Remove one track from the queue.')
				.addIntegerOption((option) =>
					option
						.setName('position')
						.setDescription('Queue position to remove.')
						.setRequired(true)
						.setMinValue(1),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('jump')
				.setDescription('Jump to a queued track.')
				.addIntegerOption((option) =>
					option
						.setName('position')
						.setDescription('Queue position to jump to.')
						.setRequired(true)
						.setMinValue(1),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('seek')
				.setDescription('Seek in the current track.')
				.addStringOption((option) =>
					option
						.setName('time')
						.setDescription('Seconds, mm:ss, or hh:mm:ss.')
						.setRequired(true)
						.setMaxLength(16),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('loop')
				.setDescription('Set repeat mode.')
				.addStringOption((option) =>
					option
						.setName('mode')
						.setDescription('Repeat mode.')
						.setRequired(true)
						.addChoices(
							{ name: 'Off', value: 'none' },
							{ name: 'Track', value: 'track' },
							{ name: 'Queue', value: 'queue' },
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('autoplay')
				.setDescription(
					'Toggle automatic recommendations after the queue ends.',
				)
				.addBooleanOption((option) =>
					option.setName('enabled').setDescription('Set autoplay on or off.'),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('filter')
				.setDescription('Apply an audio filter.')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Filter to apply.')
						.setRequired(true)
						.addChoices(...filterChoices),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('volume')
				.setDescription('Set player volume.')
				.addIntegerOption((option) =>
					option
						.setName('percent')
						.setDescription('Volume from 1 to 150.')
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(150),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('stop')
				.setDescription(
					'Stop playback, clear the queue, and close the player.',
				),
		),
	category: 'music',
	addon: 'music',
	async execute(interaction, client) {
		const guild = await requireGuild(interaction);
		if (!guild) {
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);

		try {
			const rainlink = await requireRainlink(client);
			const config = await client.guildModule(guild.id, 'music');
			if (!isMusicCommandEnabled(config, subcommand)) {
				await replyMusic(
					interaction,
					client,
					'Command disabled',
					`The music \`${subcommand}\` command is disabled in this server.`,
					true,
				);
				return;
			}

			if (!isMusicIdAllowed(config.allowedTextChannels, interaction.channelId)) {
				await replyMusic(
					interaction,
					client,
					'Text channel not allowed',
					'Music commands are limited to selected text channels in this server.',
					true,
				);
				return;
			}

			if (subcommand === 'play') {
				await interaction.deferReply();
				const member = await requireMemberVoice(interaction);
				if (!member?.voice.channel) {
					return;
				}
				if (!(await requireAllowedVoice(interaction, client, member, config))) {
					return;
				}

				const player = await createOrGetMusicPlayer(
					client,
					guild,
					interaction.channelId,
					member.voice.channel,
					config,
				);
				const result = await rainlink.search(
					interaction.options.getString('query', true),
					{
						requester: interaction.user,
						engine: String(config.searchEngine ?? 'youtube'),
					},
				);

				if (result.tracks.length === 0) {
					await replyMusic(
						interaction,
						client,
						'No results',
						'No playable tracks were found.',
						true,
					);
					return;
				}

				const maxQueueSize = Number(config.maxQueueSize ?? 500);
				const availableSlots = Math.max(
					0,
					maxQueueSize - player.queue.totalSize,
				);
				if (availableSlots <= 0) {
					await replyMusic(
						interaction,
						client,
						'Queue full',
						`This server queue is limited to **${maxQueueSize}** tracks.`,
						true,
					);
					return;
				}

				const tracks = result.tracks.slice(0, Math.max(1, availableSlots));
				player.queue.add(tracks);
				if (config.autoShuffle && player.queue.size > 1) {
					player.queue.shuffle();
				}
				await ensureMusicPlayback(player);

				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Queued',
					result.type === 'PLAYLIST'
						? `Queued **${tracks.length}** track(s) from **${result.playlistName ?? 'playlist'}**.`
						: formatTrack(tracks[0]),
					false,
				);
				return;
			}

			if (subcommand === 'join') {
				const member = await requireMemberVoice(interaction);
				if (!member?.voice.channel) {
					return;
				}
				if (!(await requireAllowedVoice(interaction, client, member, config))) {
					return;
				}

				await createOrGetMusicPlayer(
					client,
					guild,
					interaction.channelId,
					member.voice.channel,
					config,
				);
				await replyMusic(
					interaction,
					client,
					'Joined Voice',
					`Connected to <#${member.voice.channel.id}>.`,
					false,
				);
				return;
			}

			if (subcommand === 'status') {
				await replyMusic(
					interaction,
					client,
					'Music Status',
					[
						'**Nodes**',
						musicNodeStatus(client),
						'',
						'**This server**',
						musicPlayerStatus(client, guild.id),
					].join('\n'),
					true,
				);
				return;
			}

			if (subcommand === 'repair') {
				await interaction.deferReply({ ephemeral: true });
				const member = await requireMemberVoice(interaction);
				if (!member?.voice.channel) {
					return;
				}
				if (!(await requireAllowedVoice(interaction, client, member, config))) {
					return;
				}

				const result = await repairMusicPlayer(
					client,
					guild,
					interaction.channelId,
					member.voice.channel,
					config,
				);
				await replyMusic(
					interaction,
					client,
					'Music Player Repaired',
					result.restored > 0
						? `Reconnected voice and restored **${result.restored}** track(s).`
						: 'Reconnected voice. No active queue was found to restore.',
					true,
				);
				return;
			}

			const player = await requirePlayer(interaction, client);
			if (!player) {
				return;
			}

			if (subcommand === 'nowplaying') {
				await updateLivePlayer(client, player, true);
				await replyMusic(
					interaction,
					client,
					'Live Player Posted',
					'Posted a fresh live player in this channel.',
					true,
				);
				return;
			}

			if (subcommand === 'queue') {
				await interaction.reply({
					components: [buildQueueContainer(client, player)],
					flags: componentsV2ReplyFlags(true),
				});
				return;
			}

			if (!(await requireControl(interaction, client))) {
				return;
			}

			if (subcommand === 'leave') {
				await endLivePlayer(client, player, player.queue.current);
				await player.destroy();
				await replyMusic(
					interaction,
					client,
					'Left Voice',
					'Player destroyed and voice connection closed.',
					false,
				);
				return;
			}

			if (subcommand === 'previous') {
				await player.previous();
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Previous',
					'Playing the previous track.',
					false,
				);
				return;
			}

			if (subcommand === 'skip') {
				await player.skip();
				await replyMusic(
					interaction,
					client,
					'Skipped',
					'Skipped the current track.',
					false,
				);
				return;
			}

			if (subcommand === 'pause') {
				await player.pause();
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Paused',
					'Playback paused.',
					false,
				);
				return;
			}

			if (subcommand === 'resume') {
				await player.resume();
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Resumed',
					'Playback resumed.',
					false,
				);
				return;
			}

			if (subcommand === 'shuffle') {
				player.queue.shuffle();
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Queue Shuffled',
					'Upcoming tracks were shuffled.',
					false,
				);
				return;
			}

			if (subcommand === 'clear') {
				player.queue.clear();
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Queue Cleared',
					'Upcoming tracks were cleared.',
					false,
				);
				return;
			}

			if (subcommand === 'remove') {
				const position = interaction.options.getInteger('position', true);
				if (position > player.queue.size) {
					await replyMusic(
						interaction,
						client,
						'Invalid position',
						`The queue only has **${player.queue.size}** upcoming track(s).`,
						true,
					);
					return;
				}

				const removed = player.queue[position - 1];
				player.queue.remove(position - 1);
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Removed Track',
					`Removed **${removed?.title ?? 'track'}** from the queue.`,
					false,
				);
				return;
			}

			if (subcommand === 'jump') {
				const position = interaction.options.getInteger('position', true);
				if (position > player.queue.size) {
					await replyMusic(
						interaction,
						client,
						'Invalid position',
						`The queue only has **${player.queue.size}** upcoming track(s).`,
						true,
					);
					return;
				}

				player.queue.splice(0, position - 1);
				await player.skip();
				await replyMusic(
					interaction,
					client,
					'Jumped',
					`Jumped to queue position **${position}**.`,
					false,
				);
				return;
			}

			if (subcommand === 'seek') {
				const position = parseSeekTime(
					interaction.options.getString('time', true),
				);
				const current = player.queue.current;
				if (!current || current.isStream) {
					await replyMusic(
						interaction,
						client,
						'Cannot seek',
						'The current track is not seekable.',
						true,
					);
					return;
				}

				await player.seek(Math.min(position, current.duration));
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Seeked',
					`Moved playback to **${formatTrackDuration(position)}**.`,
					false,
				);
				return;
			}

			if (subcommand === 'loop') {
				const mode = loopModeFrom(interaction.options.getString('mode', true));
				player.setLoop(mode);
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Loop Updated',
					`Repeat mode is now **${mode}**.`,
					false,
				);
				return;
			}

			if (subcommand === 'autoplay') {
				const state = getMusicState(guild.id);
				state.autoplay =
					interaction.options.getBoolean('enabled') ?? !state.autoplay;
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Autoplay Updated',
					`Autoplay is now **${state.autoplay ? 'on' : 'off'}**.`,
					false,
				);
				return;
			}

			if (subcommand === 'filter') {
				const filter = interaction.options.getString('name', true) as
					| RainlinkFilterMode
					| 'clear';
				await applyMusicFilter(player, filter);
				getMusicState(guild.id).filter = filter;
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Filter Updated',
					`Applied **${musicFilters.find((item) => item.value === filter)?.label ?? filter}**.`,
					false,
				);
				return;
			}

			if (subcommand === 'volume') {
				const volume = interaction.options.getInteger('percent', true);
				await player.setVolume(volume);
				await updateLivePlayer(client, player).catch(() => undefined);
				await replyMusic(
					interaction,
					client,
					'Volume Updated',
					`Volume set to **${volume}%**.`,
					false,
				);
				return;
			}

			if (subcommand === 'stop') {
				player.setLoop(RainlinkLoopMode.NONE);
				player.queue.clear();
				await endLivePlayer(client, player, player.queue.current);
				await player.stop(true);
				await replyMusic(
					interaction,
					client,
					'Stopped',
					'Playback stopped, repeat mode was cleared, and the player was destroyed.',
					false,
				);
				return;
			}

			cycleLoop(player);
		} catch (error) {
			client.addonLogger('music').error('Music command failed:', error);
			await replyMusic(
				interaction,
				client,
				'Music unavailable',
				error instanceof Error ? error.message : 'Music playback failed.',
				true,
			).catch(() => undefined);
		}
	},
});
