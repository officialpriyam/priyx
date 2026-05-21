import {
	type ActionRowBuilder,
	type Client,
	type Guild,
	type GuildBasedChannel,
	type GuildMember,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import {
	buildV2Container,
	chunkTextDisplays,
	mediaGallery,
	type V2ContainerOptions,
} from '../../utils/embed';

export interface CreateContainerOptions extends V2ContainerOptions {
	media?: string[];
	components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export function chunkTextDisplay(content: string, limit = 3999) {
	return chunkTextDisplays(content, limit);
}

export async function simpleContainer(
	_source: unknown,
	content: string,
	options: { color?: string; withFooter?: boolean } = {},
) {
	return [
		buildV2Container({
			description: content,
			accentColor: options.color,
			footer: options.withFooter ? undefined : false,
		}),
	];
}

export async function createContainer(
	_source: unknown,
	options: CreateContainerOptions = {},
) {
	const container = buildV2Container({
		title: options.title,
		description: options.description,
		sections: options.sections,
		actionRows: options.actionRows ?? options.components,
		footer: options.footer,
		accentColor: options.accentColor,
	});

	if (options.media?.length) {
		container.addMediaGalleryComponents(
			mediaGallery(options.media.map((url) => ({ url }))),
		);
	}

	return [container];
}

export async function getChannelSafe(
	guild: Guild,
	channelId?: string | null,
): Promise<GuildBasedChannel | null> {
	if (!channelId) {
		return null;
	}

	return (
		guild.channels.cache.get(channelId) ??
		(await guild.channels.fetch(channelId).catch(() => null))
	);
}

export async function getTextChannelSafe(
	guild: Guild,
	channelId?: string | null,
) {
	const channel = await getChannelSafe(guild, channelId);
	return channel?.isTextBased() ? channel : null;
}

export async function getMemberSafe(
	guild: Guild,
	userId?: string | null,
): Promise<GuildMember | null> {
	if (!userId) {
		return null;
	}

	return (
		guild.members.cache.get(userId) ??
		(await guild.members.fetch(userId).catch(() => null))
	);
}

export async function getGuildSafe(
	client: Client,
	guildId?: string | null,
): Promise<Guild | null> {
	if (!guildId) {
		return null;
	}

	return (
		client.guilds.cache.get(guildId) ??
		(await client.guilds.fetch(guildId).catch(() => null))
	);
}

export function isOwner(userId: string): boolean {
	return (process.env.OWNER_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean)
		.includes(userId);
}

export const discordHelpers = {
	chunkTextDisplay,
	createContainer,
	getChannelSafe,
	getGuildSafe,
	getMemberSafe,
	getTextChannelSafe,
	isOwner,
	simpleContainer,
};
