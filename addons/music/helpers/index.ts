import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Guild,
	type GuildMember,
	type MessageActionRowComponentBuilder,
	type StringSelectMenuInteraction,
	type VoiceBasedChannel,
} from 'discord.js';
import {
	Library,
	Rainlink,
	RainlinkLoopMode,
	RainlinkPlayerState,
	type RainlinkFilterMode,
	type RainlinkNodeOptions,
	type RainlinkPlayer,
	type RainlinkTrack,
} from 'rainlink';
import type { PriyxClient } from '../../../src/client';
import { colors, hexToDecimal } from '../../../src/constants/colors';
import type { MusicModuleConfig } from '../../../src/types/modules';
import { componentsV2ReplyFlags } from '../../../src/utils/embed';
import { truncate } from '../../../src/utils/string';

type MusicInteraction =
	| ChatInputCommandInteraction
	| ButtonInteraction
	| StringSelectMenuInteraction;

interface MusicMessage {
	id: string;
	edit(payload: unknown): Promise<unknown>;
	delete?(): Promise<unknown>;
}

interface MusicTextChannel {
	id: string;
	send(payload: unknown): Promise<MusicMessage>;
	messages: {
		fetch(messageId: string): Promise<MusicMessage>;
	};
}

interface RuntimeState {
	autoplay: boolean;
	filter: RainlinkFilterMode | 'clear';
	messageId?: string;
	textId?: string;
	lastTrack?: RainlinkTrack | null;
	suggestions: RainlinkTrack[];
	idleTimer?: NodeJS.Timeout;
	liveUpdate?: Promise<void>;
}

export const musicFilters: {
	label: string;
	value: RainlinkFilterMode | 'clear';
	description: string;
}[] = [
	{
		label: 'Clear filters',
		value: 'clear',
		description: 'Reset audio back to normal.',
	},
	{ label: 'Bass Boost', value: 'bass', description: 'Boost low frequencies.' },
	{
		label: 'Nightcore',
		value: 'nightcore',
		description: 'Faster, brighter playback.',
	},
	{
		label: 'Vaporwave',
		value: 'vaporwave',
		description: 'Slower pitch-shifted playback.',
	},
	{ label: 'Pop', value: 'pop', description: 'Punchier vocal and mid range.' },
	{ label: 'Soft', value: 'soft', description: 'Smooth low-pass playback.' },
	{ label: 'Speed', value: 'speed', description: 'Increase playback speed.' },
	{ label: '8D', value: 'eightD', description: 'Rotating spatial audio.' },
	{
		label: 'Karaoke',
		value: 'karaoke',
		description: 'Reduce centered vocals.',
	},
	{ label: 'Tremolo', value: 'tremolo', description: 'Pulsing volume effect.' },
];

const runtimeStates = new Map<string, RuntimeState>();
let uiTicker: NodeJS.Timeout | null = null;

function stateFor(guildId: string): RuntimeState {
	const existing = runtimeStates.get(guildId);
	if (existing) {
		return existing;
	}

	const created: RuntimeState = {
		autoplay: false,
		filter: 'clear',
		suggestions: [],
	};
	runtimeStates.set(guildId, created);
	return created;
}

function resolveEnv(value: string): string {
	return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
		return process.env[name] ?? '';
	});
}

function configuredNodes(config: MusicModuleConfig): RainlinkNodeOptions[] {
	return (config.lavalink?.nodes ?? [])
		.map((node) => ({
			name: node.name,
			host: resolveEnv(node.host),
			port: Number(node.port),
			auth: resolveEnv(node.auth),
			secure: Boolean(node.secure),
			driver: node.driver,
			region: node.region,
		}))
		.filter((node) => node.name && node.host && node.port && node.auth);
}

function isMusicTextChannel(channel: unknown): channel is MusicTextChannel {
	if (typeof channel !== 'object' || channel === null) {
		return false;
	}

	const candidate = channel as {
		id?: unknown;
		send?: unknown;
		messages?: { fetch?: unknown };
	};
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.send === 'function' &&
		typeof candidate.messages?.fetch === 'function'
	);
}

function textDisplay(content: string): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(content);
}

function separator(divider = true): SeparatorBuilder {
	return new SeparatorBuilder()
		.setDivider(divider)
		.setSpacing(SeparatorSpacingSize.Small);
}

function musicAccent(client: PriyxClient): number {
	return hexToDecimal(client.module('colors').music ?? colors.music);
}

function requesterId(track?: RainlinkTrack | null): string | null {
	const requester = track?.requester;
	if (
		typeof requester === 'object' &&
		requester !== null &&
		'id' in requester &&
		typeof requester.id === 'string'
	) {
		return requester.id;
	}

	return null;
}

function requesterText(track?: RainlinkTrack | null): string {
	const id = requesterId(track);
	return id ? `<@${id}>` : 'Unknown requester';
}

function safeTitle(track?: RainlinkTrack | null): string {
	return truncate(
		track?.title?.replace(/\s+/g, ' ').trim() || 'Unknown track',
		95,
	);
}

function isRainlinkTrack(track: unknown): track is RainlinkTrack {
	return typeof track === 'object' && track !== null;
}

function formatUnknownError(value: unknown): string {
	if (value instanceof Error) {
		return value.stack ?? value.message;
	}

	if (typeof value === 'string') {
		return value;
	}

	try {
		const serialized = JSON.stringify(value);
		return serialized && serialized !== '{}' ? serialized : String(value);
	} catch {
		return String(value);
	}
}

function trackUrl(track?: RainlinkTrack | null): string | null {
	return track?.uri || track?.realUri || null;
}

function trackLink(track?: RainlinkTrack | null): string {
	const title = safeTitle(track);
	const url = trackUrl(track);
	return url ? `[${title}](${url})` : title;
}

function artworkUrl(track?: RainlinkTrack | null): string | null {
	return track?.artworkUrl || null;
}

function clearIdleTimer(state: RuntimeState): void {
	if (state.idleTimer) {
		clearTimeout(state.idleTimer);
		state.idleTimer = undefined;
	}
}

function toActionRow(
	row:
		| ActionRowBuilder<ButtonBuilder>
		| ActionRowBuilder<StringSelectMenuBuilder>,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return row as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>;
}

function button(
	customId: string,
	label: string,
	style = ButtonStyle.Secondary,
	disabled = false,
): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(style)
		.setDisabled(disabled);
}

function loopLabel(loop: RainlinkLoopMode): string {
	if (loop === RainlinkLoopMode.SONG) {
		return 'Loop: Track';
	}

	if (loop === RainlinkLoopMode.QUEUE) {
		return 'Loop: Queue';
	}

	return 'Loop: Off';
}

function filterLabel(value: RuntimeState['filter']): string {
	return (
		musicFilters.find((filter) => filter.value === value)?.label ??
		'Clear filters'
	);
}

function playerControls(
	player: RainlinkPlayer,
	state: RuntimeState,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	return [
		toActionRow(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				button(
					'music:player:autoplay',
					state.autoplay ? 'Autoplay: On' : 'Autoplay: Off',
				),
				button(
					'music:player:previous',
					'Back',
					ButtonStyle.Secondary,
					player.queue.previous.length === 0,
				),
				button('music:player:pause', player.paused ? 'Resume' : 'Pause'),
				button('music:player:skip', 'Skip'),
				button('music:player:loop', loopLabel(player.loop)),
			),
		),
		toActionRow(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				button('music:player:queue', 'Queue'),
				button('music:player:shuffle', 'Shuffle'),
				button('music:player:stop', 'Stop', ButtonStyle.Danger),
			),
		),
	];
}

function filterRow(): ActionRowBuilder<MessageActionRowComponentBuilder> {
	const select = new StringSelectMenuBuilder()
		.setCustomId('music:filter')
		.setPlaceholder('Audio filters')
		.addOptions(
			musicFilters.map((filter) =>
				new StringSelectMenuOptionBuilder()
					.setLabel(filter.label)
					.setValue(filter.value)
					.setDescription(filter.description),
			),
		);

	return toActionRow(
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
	);
}

function suggestionRow(
	state: RuntimeState,
): ActionRowBuilder<MessageActionRowComponentBuilder> | null {
	const select = new StringSelectMenuBuilder()
		.setCustomId('music:suggest')
		.setPlaceholder(
			state.suggestions.length > 0
				? 'Add a suggested track'
				: 'No suggestions available yet',
		)
		.setDisabled(state.suggestions.length === 0);

	if (state.suggestions.length === 0) {
		select.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel('No suggestions available')
				.setValue('none')
				.setDescription('Suggestions appear after the player starts a track.'),
		);
		return toActionRow(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
		);
	}

	select.addOptions(
		state.suggestions.slice(0, 10).map((track, index) =>
			new StringSelectMenuOptionBuilder()
				.setLabel(safeTitle(track))
				.setValue(String(index))
				.setDescription(truncate(track.author || 'Unknown artist', 95)),
		),
	);

	return toActionRow(
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
	);
}

export function formatTrackDuration(ms?: number | null): string {
	if (!ms || Number.isNaN(ms) || ms < 0) {
		return '0:00';
	}

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
			.toString()
			.padStart(2, '0')}`;
	}

	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function createProgressBar(player: RainlinkPlayer): string {
	const current = player.queue.current;
	if (!current) {
		return '`0:00 [--------------------] 0:00`';
	}

	if (current.isStream) {
		return '`LIVE [====================]`';
	}

	const total = Math.max(current.duration, 1);
	const position = Math.min(Math.max(player.position, 0), total);
	const size = 20;
	const filled = Math.min(
		size,
		Math.max(0, Math.round((position / total) * size)),
	);
	const empty = size - filled;
	return `\`${formatTrackDuration(position)} [${'='.repeat(filled)}${'>'.repeat(filled < size ? 1 : 0)}${'-'.repeat(Math.max(0, empty - 1))}] ${formatTrackDuration(total)}\``;
}

export function formatTrack(track?: RainlinkTrack | null): string {
	if (!track) {
		return 'Nothing is playing.';
	}

	const duration = track.isStream
		? 'Live stream'
		: formatTrackDuration(track.duration);
	return [
		trackLink(track),
		`Artist: **${track.author || 'Unknown'}**`,
		`Duration: **${duration}**`,
		`Requested by: ${requesterText(track)}`,
	].join('\n');
}

export function buildSimpleMusicContainer(
	client: PriyxClient,
	title: string,
	description: string,
): ContainerBuilder {
	return new ContainerBuilder()
		.setAccentColor(musicAccent(client))
		.addTextDisplayComponents(textDisplay(`## ${title}`))
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(textDisplay(description))
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(
			textDisplay(`${client.module('bot').name} music`),
		);
}

function nowPlayingContainer(
	client: PriyxClient,
	player: RainlinkPlayer,
): ContainerBuilder {
	const state = stateFor(player.guildId);
	const current = player.queue.current;
	const container = new ContainerBuilder().setAccentColor(musicAccent(client));
	const art = artworkUrl(current);
	const title = current
		? `## Now Playing\n${trackLink(current)}`
		: '## Music Player\nIdle';

	if (art) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(textDisplay(title))
				.setThumbnailAccessory(
					new ThumbnailBuilder({
						media: { url: art },
						description: safeTitle(current),
					}),
				),
		);
	} else {
		container.addTextDisplayComponents(textDisplay(title));
	}

	container
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(textDisplay(createProgressBar(player)))
		.addTextDisplayComponents(
			textDisplay(
				[
					`Artist: **${current?.author || 'Unknown'}**`,
					`Requested by: ${requesterText(current)}`,
					`Volume: **${player.volume}%**`,
					`Loop: **${loopLabel(player.loop).replace('Loop: ', '')}**`,
					`Autoplay: **${state.autoplay ? 'On' : 'Off'}**`,
					`Filter: **${filterLabel(state.filter)}**`,
					`Queue: **${player.queue.size} upcoming**`,
				].join('\n'),
			),
		);

	const suggestion = suggestionRow(state);
	if (suggestion) {
		container
			.addSeparatorComponents(separator())
			.addActionRowComponents(suggestion);
	}

	container
		.addSeparatorComponents(separator())
		.addActionRowComponents(filterRow());

	for (const row of playerControls(player, state)) {
		container.addActionRowComponents(row);
	}

	container
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(
			textDisplay(`${client.module('bot').name} live player`),
		);

	return container;
}

function endedContainer(
	client: PriyxClient,
	track?: RainlinkTrack | null,
): ContainerBuilder {
	const container = new ContainerBuilder().setAccentColor(colors.error);
	const art = artworkUrl(track);
	const title = track
		? `## Playback Ended\n${trackLink(track)}`
		: '## Playback Ended';

	if (art) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(textDisplay(title))
				.setThumbnailAccessory(
					new ThumbnailBuilder({
						media: { url: art },
						description: safeTitle(track),
					}),
				),
		);
	} else {
		container.addTextDisplayComponents(textDisplay(title));
	}

	return container
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(
			textDisplay('Queue is empty. Use `/music play` to start another track.'),
		)
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(
			textDisplay(`${client.module('bot').name} music`),
		);
}

async function writeLivePlayer(
	client: PriyxClient,
	player: RainlinkPlayer,
	forceSend = false,
): Promise<void> {
	const state = stateFor(player.guildId);
	const channel = client.channels.cache.get(player.textId);
	if (!isMusicTextChannel(channel)) {
		return;
	}

	state.textId = channel.id;
	const payload = {
		components: [nowPlayingContainer(client, player)],
		flags: MessageFlags.IsComponentsV2 as const,
	};

	if (!forceSend && state.messageId) {
		const existing = await channel.messages
			.fetch(state.messageId)
			.catch(() => null);
		if (existing) {
			await existing.edit(payload);
			return;
		}
	}

	const message = await channel.send(payload);
	state.messageId = message.id;
}

export async function updateLivePlayer(
	client: PriyxClient,
	player: RainlinkPlayer,
	forceSend = false,
): Promise<void> {
	const state = stateFor(player.guildId);
	const previous = state.liveUpdate?.catch(() => undefined);
	const current = (async () => {
		await previous;
		await writeLivePlayer(client, player, forceSend);
	})();

	let pending: Promise<void>;
	pending = current.finally(() => {
		if (state.liveUpdate === pending) {
			state.liveUpdate = undefined;
		}
	});
	state.liveUpdate = pending;

	return pending;
}

export async function endLivePlayer(
	client: PriyxClient,
	player: RainlinkPlayer,
	track?: RainlinkTrack | null,
): Promise<void> {
	const state = stateFor(player.guildId);
	clearIdleTimer(state);
	state.suggestions = [];
	const channelId = state.textId ?? player.textId;
	const channel = client.channels.cache.get(channelId);
	if (!isMusicTextChannel(channel)) {
		return;
	}

	const payload = {
		components: [endedContainer(client, track ?? state.lastTrack)],
		flags: MessageFlags.IsComponentsV2 as const,
	};

	if (state.messageId) {
		const existing = await channel.messages
			.fetch(state.messageId)
			.catch(() => null);
		if (existing) {
			await existing.edit(payload);
			return;
		}
	}

	const message = await channel.send(payload);
	state.messageId = message.id;
}

export async function ensureMusicPlayback(
	player: RainlinkPlayer,
): Promise<void> {
	if (!player.queue.current && player.queue.size === 0) {
		return;
	}

	if (!player.playing) {
		await player.play();
	}

	if (player.paused) {
		await player.resume();
	}

	player.playing = true;
	player.paused = false;
}

export async function replyMusic(
	interaction: MusicInteraction,
	client: PriyxClient,
	title: string,
	description: string,
	ephemeral = true,
): Promise<void> {
	const payload = {
		components: [buildSimpleMusicContainer(client, title, description)],
		flags: componentsV2ReplyFlags(ephemeral),
	};

	if (interaction.deferred || interaction.replied) {
		await interaction.editReply(payload);
		return;
	}

	await interaction.reply(payload);
}

export function getMusicPlayer(
	client: PriyxClient,
	guildId: string,
): RainlinkPlayer | null {
	return client.rainlink?.players.get(guildId) ?? null;
}

export function getMusicState(guildId: string): RuntimeState {
	return stateFor(guildId);
}

export async function createOrGetMusicPlayer(
	client: PriyxClient,
	guild: Guild,
	textId: string,
	voiceChannel: VoiceBasedChannel,
	config: MusicModuleConfig,
): Promise<RainlinkPlayer> {
	setupRainlink(client);
	if (!client.rainlink) {
		throw new Error(
			'Rainlink is not configured. Add a Lavalink node in modules.yml.',
		);
	}

	const existing = getMusicPlayer(client, guild.id);
	if (existing) {
		if (existing.voiceId && existing.voiceId !== voiceChannel.id) {
			throw new Error(`Music is already active in <#${existing.voiceId}>.`);
		}

		if (existing.state !== RainlinkPlayerState.CONNECTED || !existing.voiceId) {
			await existing.destroy().catch(() => undefined);
		} else {
			existing.setTextChannel(textId);
			return existing;
		}
	}

	const player = await client.rainlink.create({
		guildId: guild.id,
		textId,
		voiceId: voiceChannel.id,
		shardId: guild.shardId,
		volume: Number(config.defaultVolume ?? 80),
		deaf: true,
	});
	player.setLoop(RainlinkLoopMode.NONE);
	stateFor(guild.id).autoplay = Boolean(config.autoplay ?? false);
	return player;
}

export async function recreateMusicPlayer(
	client: PriyxClient,
	guild: Guild,
	textId: string,
	voiceChannel: VoiceBasedChannel,
	config: MusicModuleConfig,
): Promise<RainlinkPlayer> {
	const existing = getMusicPlayer(client, guild.id);
	if (existing) {
		await existing.destroy().catch(() => undefined);
	}

	const player = await createOrGetMusicPlayer(
		client,
		guild,
		textId,
		voiceChannel,
		config,
	);
	player.setLoop(RainlinkLoopMode.NONE);
	return player;
}

export function musicNodeStatus(client: PriyxClient): string {
	if (!client.rainlink) {
		return 'Rainlink is not initialized.';
	}

	const nodes = client.rainlink.nodes.full;
	if (nodes.length === 0) {
		return 'No Lavalink nodes are loaded.';
	}

	return nodes
		.map(([, node]) => {
			const stats = node.stats;
			return [
				`**${node.options.name}:** ${node.online ? 'online' : 'offline'}`,
				`host ${node.options.host}:${node.options.port}`,
				`players ${stats?.players ?? 0}/${stats?.playingPlayers ?? 0}`,
			].join(' - ');
		})
		.join('\n');
}

export function musicPlayerStatus(
	client: PriyxClient,
	guildId: string,
): string {
	const player = getMusicPlayer(client, guildId);
	if (!player) {
		return 'No active player for this server.';
	}

	return [
		`Voice: **${player.voiceId ? `<#${player.voiceId}>` : 'not connected'}**`,
		`Text: **<#${player.textId}>**`,
		`State: **${RainlinkPlayerState[player.state] ?? player.state}**`,
		`Playing: **${player.playing ? 'true' : 'false'}**`,
		`Paused: **${player.paused ? 'true' : 'false'}**`,
		`Current: **${safeTitle(player.queue.current)}**`,
		`Queue: **${player.queue.size} upcoming**`,
		`Loop: **${player.loop}**`,
		`Volume: **${player.volume}%**`,
	].join('\n');
}

export async function repairMusicPlayer(
	client: PriyxClient,
	guild: Guild,
	textId: string,
	voiceChannel: VoiceBasedChannel,
	config: MusicModuleConfig,
): Promise<{ player: RainlinkPlayer; restored: number }> {
	const existing = getMusicPlayer(client, guild.id);
	const current = existing?.queue.current ?? null;
	const upcoming = existing ? [...existing.queue] : [];
	const state = stateFor(guild.id);
	const autoplay = state.autoplay;
	const filter = state.filter;

	const player = await recreateMusicPlayer(
		client,
		guild,
		textId,
		voiceChannel,
		config,
	);
	state.autoplay = autoplay;
	state.filter = filter;
	state.suggestions = [];

	const tracks = [current, ...upcoming].filter(
		(track): track is RainlinkTrack => Boolean(track),
	);
	if (tracks.length > 0) {
		player.queue.add(tracks);
		await ensureMusicPlayback(player);
	}

	await updateLivePlayer(client, player).catch(() => undefined);
	return { player, restored: tracks.length };
}

export async function fetchGuildMember(
	interaction: MusicInteraction,
): Promise<GuildMember | null> {
	if (!interaction.guild) {
		return null;
	}

	return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}

export async function requireSameVoice(
	interaction: MusicInteraction,
	player: RainlinkPlayer,
): Promise<boolean> {
	const member = await fetchGuildMember(interaction);
	if (!member?.voice.channelId) {
		await replyMusic(
			interaction,
			interaction.client as PriyxClient,
			'Join a voice channel',
			'You need to be in the same voice channel as the player.',
		);
		return false;
	}

	if (player.voiceId && member.voice.channelId !== player.voiceId) {
		await replyMusic(
			interaction,
			interaction.client as PriyxClient,
			'Wrong voice channel',
			`Join <#${player.voiceId}> to control this player.`,
		);
		return false;
	}

	return true;
}

export async function hasControlPermission(
	interaction: MusicInteraction,
	player: RainlinkPlayer,
	config: MusicModuleConfig,
): Promise<boolean> {
	const member = await fetchGuildMember(interaction);
	if (!member) {
		return false;
	}

	if (
		member.permissions.has(PermissionFlagsBits.Administrator) ||
		member.permissions.has(PermissionFlagsBits.ManageGuild)
	) {
		return true;
	}

	if (config.djRole && member.roles.cache.has(config.djRole)) {
		return true;
	}

	return requesterId(player.queue.current) === interaction.user.id;
}

export function cycleLoop(player: RainlinkPlayer): RainlinkLoopMode {
	if (player.loop === RainlinkLoopMode.NONE) {
		player.setLoop(RainlinkLoopMode.SONG);
		return RainlinkLoopMode.SONG;
	}

	if (player.loop === RainlinkLoopMode.SONG) {
		player.setLoop(RainlinkLoopMode.QUEUE);
		return RainlinkLoopMode.QUEUE;
	}

	player.setLoop(RainlinkLoopMode.NONE);
	return RainlinkLoopMode.NONE;
}

export function parseSeekTime(input: string): number {
	const parts = input
		.trim()
		.split(':')
		.map((part) => Number(part));
	if (
		parts.length === 0 ||
		parts.some((part) => Number.isNaN(part) || part < 0)
	) {
		throw new Error('Use seconds, mm:ss, or hh:mm:ss.');
	}

	let seconds = 0;
	for (const part of parts) {
		seconds = seconds * 60 + part;
	}

	return seconds * 1000;
}

export async function applyMusicFilter(
	player: RainlinkPlayer,
	filter: RainlinkFilterMode | 'clear',
): Promise<void> {
	if (filter === 'clear') {
		await player.filter.clear();
		return;
	}

	await player.filter.set(filter);
}

export async function fetchRecommendations(
	client: PriyxClient,
	player: RainlinkPlayer,
	track: RainlinkTrack,
	limit = 5,
): Promise<RainlinkTrack[]> {
	if (!client.rainlink || !track.identifier) {
		return [];
	}

	const searchUrl = `https://www.youtube.com/watch?v=${track.identifier}&list=RD${track.identifier}`;
	const result = await client.rainlink.search(searchUrl, {
		requester: track.requester,
		engine: 'youtube',
	});

	const seen = new Set([
		track.identifier,
		...player.queue.previous.map((item) => item.identifier),
	]);
	return result.tracks
		.filter(
			(candidate) => candidate.identifier && !seen.has(candidate.identifier),
		)
		.slice(0, limit);
}

export async function addSuggestionToQueue(
	client: PriyxClient,
	player: RainlinkPlayer,
	index: number,
): Promise<RainlinkTrack> {
	const state = stateFor(player.guildId);
	const track = state.suggestions[index];
	if (!track) {
		throw new Error(
			'That suggestion expired. Use `/music play` or wait for the next track.',
		);
	}

	player.queue.add(track);
	if (!player.queue.current || (!player.playing && player.queue.current)) {
		await ensureMusicPlayback(player);
	}

	await updateLivePlayer(client, player).catch(() => undefined);
	return track;
}

function queueSummary(player: RainlinkPlayer, page = 1): string {
	const totalPages = Math.max(1, Math.ceil(player.queue.size / 10));
	const safePage = Math.min(Math.max(page, 1), totalPages);
	const start = (safePage - 1) * 10;
	const upcoming = [...player.queue].slice(start, start + 10);

	return [
		`Now: ${formatTrack(player.queue.current)}`,
		'',
		upcoming.length > 0
			? upcoming
					.map(
						(track, index) =>
							`${start + index + 1}. ${safeTitle(track)} - ${formatTrackDuration(track.duration)}`,
					)
					.join('\n')
			: 'No queued tracks.',
		'',
		`Page ${safePage}/${totalPages} - ${player.queue.size} upcoming track(s).`,
	].join('\n');
}

export function buildQueueContainer(
	client: PriyxClient,
	player: RainlinkPlayer,
	page = 1,
): ContainerBuilder {
	return buildSimpleMusicContainer(
		client,
		'Music Queue',
		queueSummary(player, page),
	);
}

async function handleAutoplay(
	client: PriyxClient,
	player: RainlinkPlayer,
	state: RuntimeState,
): Promise<boolean> {
	const reference = state.lastTrack ?? player.queue.current;
	if (!state.autoplay || !reference) {
		return false;
	}

	const recommendations = await fetchRecommendations(
		client,
		player,
		reference,
		5,
	).catch(() => []);
	const next = recommendations[0];
	if (!next) {
		return false;
	}

	player.queue.add(next);
	await ensureMusicPlayback(player);
	return true;
}

function scheduleIdleDestroy(
	client: PriyxClient,
	player: RainlinkPlayer,
	config: MusicModuleConfig,
	state: RuntimeState,
): void {
	clearIdleTimer(state);
	const leaveOnFinish = config.leaveOnFinish ?? false;
	if (leaveOnFinish) {
		void player.destroy().catch(() => undefined);
		return;
	}

	const leaveOnEmpty = config.leaveOnEmpty ?? true;
	if (!leaveOnEmpty) {
		return;
	}

	const delaySeconds = Number(config.leaveOnEmptyDelay ?? 180);
	if (delaySeconds <= 0) {
		void player.destroy().catch(() => undefined);
		return;
	}

	state.idleTimer = setTimeout(() => {
		const current = client.rainlink?.players.get(player.guildId);
		if (current && current.queue.size === 0 && !current.queue.current) {
			void current.destroy().catch(() => undefined);
		}
	}, delaySeconds * 1000);
}

function normalizeIdlePlayer(player: RainlinkPlayer): void {
	player.setLoop(RainlinkLoopMode.NONE);
	player.queue.clear();
	player.queue.current = null;
	player.playing = false;
	player.paused = true;
	player.track = null;
}

function startMusicTicker(client: PriyxClient): void {
	if (uiTicker) {
		return;
	}

	const updateInterval =
		Number(client.module('music').ui?.updateInterval ?? 5000) || 5000;
	uiTicker = setInterval(
		() => {
			const players = client.rainlink?.players.values ?? [];
			for (const player of players) {
				if (player.queue.current && player.state !== 2) {
					void updateLivePlayer(client, player).catch((error) => {
						client
							.addonLogger('music')
							.warn('Live player update failed:', error);
					});
				}
			}
		},
		Math.max(3000, updateInterval),
	);
	uiTicker.unref();
}

export function setupRainlink(client: PriyxClient): void {
	if (client.rainlink) {
		startMusicTicker(client);
		return;
	}

	const config = client.module('music');
	const nodes = configuredNodes(config);
	const log = client.addonLogger('music');

	if (config.provider && config.provider !== 'rainlink') {
		log.warn(
			`Unsupported music provider "${config.provider}". Using rainlink.`,
		);
	}

	if (nodes.length === 0) {
		log.warn(
			'Rainlink is not configured because no Lavalink nodes were provided.',
		);
		return;
	}

	const rainlink = new Rainlink({
		library: new Library.DiscordJS(client),
		nodes,
		options: {
			defaultSearchEngine: config.searchEngine ?? 'youtube',
			defaultVolume: config.defaultVolume ?? 80,
		},
	});

	rainlink.on('nodeConnect', (node) => {
		log.info(`Lavalink node ${node.options.name} connected.`);
	});
	rainlink.on('nodeDisconnect', (node, code, reason) => {
		log.warn(
			`Lavalink node ${node.options.name} disconnected (${code}): ${String(
				reason ?? 'no reason',
			)}`,
		);
	});
	rainlink.on('nodeError', (node, error) => {
		log.error(`Lavalink node ${node.options.name} error:`, error);
	});
	rainlink.on('nodeClosed', (node) => {
		log.warn(`Lavalink node ${node.options.name} closed.`);
	});
	rainlink.on('playerCreate', (player) => {
		const state = stateFor(player.guildId);
		state.autoplay = Boolean(config.autoplay ?? false);
		state.filter = 'clear';
		state.suggestions = [];
		player.setLoop(RainlinkLoopMode.NONE);
		log.info(
			`Player created for guild ${player.guildId} in voice ${player.voiceId}.`,
		);
	});
	rainlink.on('queueAdd', (player, queue, tracks) => {
		log.info(
			`Queued ${tracks.length} track(s) for guild ${player.guildId}. Queue size: ${queue.size}.`,
		);
	});
	rainlink.on('trackStart', async (player, track) => {
		const guildConfig = await client
			.guildModule(player.guildId, 'music')
			.catch(() => config);
		const state = stateFor(player.guildId);
		const current = isRainlinkTrack(track)
			? track
			: (player.queue.current ?? null);
		if (!current) {
			log.warn(
				`Track start emitted without a track in guild ${player.guildId}. Player state: playing=${player.playing}, paused=${player.paused}, queue=${player.queue.size}.`,
			);
			state.suggestions = [];
			await updateLivePlayer(client, player).catch((error) => {
				log.warn(
					'Failed to update live player after empty track start:',
					error,
				);
			});
			return;
		}

		clearIdleTimer(state);
		player.playing = true;
		player.paused = false;
		state.lastTrack = current;
		log.info(
			`Track started in guild ${player.guildId}: ${safeTitle(current)} (${current.identifier ?? 'no identifier'}).`,
		);
		state.suggestions = await fetchRecommendations(
			client,
			player,
			current,
			Number(guildConfig.ui?.suggestionLimit ?? 5),
		).catch(() => []);
		await updateLivePlayer(client, player).catch((error) => {
			log.warn('Failed to send live player:', error);
		});
	});
	rainlink.on('trackEnd', (player, track) => {
		log.info(
			`Track ended in guild ${player.guildId}: ${track?.title ?? 'unknown track'}.`,
		);
	});
	rainlink.on('trackStuck', (player, data) => {
		log.warn(`Track stuck in guild ${player.guildId}: ${JSON.stringify(data)}`);
	});
	rainlink.on('trackResolveError', (player, track, message) => {
		log.warn(
			`Track resolve failed in guild ${player.guildId}: ${safeTitle(track)} - ${message}`,
		);
	});
	rainlink.on('playerException', (player, data) => {
		log.error(
			`Player exception in guild ${player.guildId}: ${formatUnknownError(data)}`,
		);
	});
	rainlink.on('queueEmpty', async (player) => {
		const guildConfig = await client
			.guildModule(player.guildId, 'music')
			.catch(() => config);
		const state = stateFor(player.guildId);
		const endedTrack = state.lastTrack ?? player.queue.current;
		log.info(`Queue empty in guild ${player.guildId}.`);
		if (await handleAutoplay(client, player, state)) {
			return;
		}

		normalizeIdlePlayer(player);
		state.suggestions = [];
		await endLivePlayer(client, player, endedTrack).catch((error) => {
			log.warn('Failed to close live player:', error);
		});
		scheduleIdleDestroy(client, player, guildConfig, state);
	});
	rainlink.on('playerDestroy', (player) => {
		const state = runtimeStates.get(player.guildId);
		if (state) {
			clearIdleTimer(state);
		}
	});

	client.rainlink = rainlink;
	startMusicTicker(client);
	log.info(`Rainlink initialized with ${nodes.length} Lavalink node(s).`);
}

export const MusicHelper = {
	addSuggestionToQueue,
	applyMusicFilter,
	buildQueueContainer,
	buildSimpleMusicContainer,
	cacheKey(...parts: string[]): string {
		return ['music', ...parts].join(':');
	},
	createOrGetMusicPlayer,
	createProgressBar,
	cycleLoop,
	ensureMusicPlayback,
	endLivePlayer,
	fetchGuildMember,
	formatTrack,
	formatTrackDuration,
	getMusicPlayer,
	getMusicState,
	hasControlPermission,
	musicNodeStatus,
	musicPlayerStatus,
	musicFilters,
	parseSeekTime,
	repairMusicPlayer,
	replyMusic,
	requireSameVoice,
	recreateMusicPlayer,
	setupRainlink,
	updateLivePlayer,
};
