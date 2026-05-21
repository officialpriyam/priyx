import {
	EmbedBuilder,
	type Guild,
	type GuildMember,
	type MessageCreateOptions,
	type PartialGuildMember,
} from 'discord.js';
import { hexToDecimal } from '../../../src/constants/colors';
import { interpolate, type TranslationVariables } from '../../../src/i18n';
import type { ModuleValue, WelcomerModuleConfig } from '../../../src/types/modules';

type WelcomeSubject = GuildMember | PartialGuildMember;
type MessageMode = 'plain' | 'embed' | 'both';

interface WelcomerEmbedField {
	name?: string;
	value?: string;
	inline?: boolean;
}

interface WelcomerEmbedConfig {
	title?: string;
	description?: string;
	color?: string;
	authorName?: string;
	authorIcon?: string;
	thumbnail?: string;
	image?: string;
	footer?: string;
	timestamp?: boolean;
	fields?: WelcomerEmbedField[];
}

interface WelcomerMessageConfig {
	enabled?: boolean;
	channel?: string;
	messageType?: MessageMode;
	message?: string;
	content?: string;
	mentionUser?: boolean;
	embed?: WelcomerEmbedConfig;
	deleteAfter?: number;
}

export const WelcomerHelper = {
	moduleName: 'welcomer',
	cacheKey(...parts: string[]): string {
		return ['welcomer', ...parts].join(':');
	},
};

function isRecord(value: ModuleValue): value is Record<string, ModuleValue> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function objectValue<T>(
	value: ModuleValue,
): T | undefined {
	return isRecord(value) ? (value as T) : undefined;
}

function stringValue(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function userAvatar(subject: WelcomeSubject): string {
	return subject.user.displayAvatarURL({ size: 128 });
}

function variables(subject: WelcomeSubject): TranslationVariables {
	return {
		user: subject.toString(),
		username: subject.user.username,
		tag: subject.user.tag,
		id: subject.id,
		server: subject.guild.name,
		count: subject.guild.memberCount,
		avatar: userAvatar(subject),
	};
}

function render(template: string | undefined, subject: WelcomeSubject): string {
	return interpolate(template ?? '', variables(subject));
}

function normalizeMode(value: unknown): MessageMode {
	return value === 'plain' || value === 'both' ? value : 'embed';
}

function legacyWelcomeConfig(config: WelcomerModuleConfig): WelcomerMessageConfig {
	const welcome = objectValue<WelcomerMessageConfig>(config.welcome);
	return {
		enabled: true,
		channel: welcome?.channel ?? config.channel,
		messageType: welcome?.messageType ?? config.messageType ?? 'embed',
		message: welcome?.message ?? config.message,
		content: welcome?.content,
		mentionUser: welcome?.mentionUser ?? config.mentionUser,
		embed: welcome?.embed ?? objectValue<WelcomerEmbedConfig>(config.embed),
		deleteAfter: welcome?.deleteAfter ?? config.deleteAfter,
	};
}

export function getWelcomerTarget(
	config: WelcomerModuleConfig,
	kind: 'welcome' | 'farewell',
): WelcomerMessageConfig {
	if (kind === 'welcome') {
		return legacyWelcomeConfig(config);
	}

	const farewell = objectValue<WelcomerMessageConfig>(config.farewell);
	return {
		enabled: Boolean(farewell?.enabled),
		channel: farewell?.channel,
		messageType: farewell?.messageType ?? 'embed',
		message: farewell?.message,
		content: farewell?.content,
		embed: farewell?.embed,
		deleteAfter: farewell?.deleteAfter,
	};
}

function buildEmbed(
	subject: WelcomeSubject,
	kind: 'welcome' | 'farewell' | 'dm',
	target: WelcomerMessageConfig,
): EmbedBuilder {
	const fallbackTitle =
		kind === 'farewell'
			? 'Goodbye'
			: kind === 'dm'
				? `Welcome to ${subject.guild.name}`
				: 'Welcome';
	const fallbackDescription =
		target.message ??
		(kind === 'farewell'
			? '{username} has left {server}.'
			: 'Welcome {user} to {server}! You are member #{count}.');
	const embed = target.embed ?? {};
	const builder = new EmbedBuilder()
		.setTitle(render(embed.title ?? fallbackTitle, subject))
		.setDescription(render(embed.description ?? fallbackDescription, subject))
		.setColor(hexToDecimal(embed.color ?? '#6C63FF'));

	const authorName = render(embed.authorName, subject);
	if (authorName) {
		builder.setAuthor({
			name: authorName,
			iconURL: render(embed.authorIcon, subject) || userAvatar(subject),
		});
	}

	const thumbnail = render(embed.thumbnail, subject);
	if (thumbnail) {
		builder.setThumbnail(thumbnail);
	}

	const image = render(embed.image, subject);
	if (image) {
		builder.setImage(image);
	}

	const footer = render(embed.footer, subject);
	if (footer) {
		builder.setFooter({ text: footer });
	}

	if (booleanValue(embed.timestamp, true)) {
		builder.setTimestamp();
	}

	const fields = Array.isArray(embed.fields) ? embed.fields : [];
	for (const field of fields.slice(0, 25)) {
		const name = render(field.name, subject);
		const value = render(field.value, subject);
		if (name && value) {
			builder.addFields({
				name,
				value,
				inline: booleanValue(field.inline, false),
			});
		}
	}

	return builder;
}

export function buildWelcomerMessage(
	subject: WelcomeSubject,
	kind: 'welcome' | 'farewell' | 'dm',
	target: WelcomerMessageConfig,
): MessageCreateOptions {
	const mode = normalizeMode(target.messageType);
	const fallback =
		target.content ??
		target.message ??
		(kind === 'farewell'
			? '{username} has left {server}.'
			: 'Welcome {user} to {server}! You are member #{count}.');
	const content = render(fallback, subject);
	const payload: MessageCreateOptions = {};

	if (mode === 'plain' || mode === 'both') {
		payload.content = content;
	} else if (target.mentionUser) {
		payload.content = subject.toString();
	}
	if (mode === 'embed' || mode === 'both') {
		payload.embeds = [buildEmbed(subject, kind, target)];
	}

	return payload;
}

export function welcomeDmConfig(
	config: WelcomerModuleConfig,
): WelcomerMessageConfig | undefined {
	const dm = objectValue<WelcomerMessageConfig>(config.dm);
	if (!dm?.enabled) {
		return undefined;
	}

	return {
		enabled: true,
		messageType: dm.messageType ?? 'plain',
		message: dm.message,
		content: dm.content,
		embed: dm.embed,
	};
}

export async function scheduleDelete(
	message: { delete: () => Promise<unknown> },
	deleteAfter?: number,
): Promise<void> {
	const seconds = numberValue(deleteAfter, 0);
	if (seconds <= 0) {
		return;
	}

	setTimeout(() => {
		void message.delete().catch(() => undefined);
	}, Math.min(seconds, 604_800) * 1000);
}

export async function assignWelcomeRoles(
	member: GuildMember,
	config: WelcomerModuleConfig,
): Promise<void> {
	const roles = Array.isArray(config.assignRoles) ? config.assignRoles : [];
	const ids = roles.filter((role): role is string => typeof role === 'string' && role.length > 0);
	if (ids.length === 0) {
		return;
	}

	await member.roles.add(ids).catch(() => undefined);
}

export function channelFromGuild(guild: Guild, channelId?: string) {
	return channelId ? guild.channels.cache.get(channelId) : undefined;
}
