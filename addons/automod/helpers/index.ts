import {
	MessageFlags,
	PermissionsBitField,
	type GuildMember,
	type Message,
} from 'discord.js';
import type { PriyxClient } from '../../../src/client';
import type {
	AutomodModuleConfig,
	ModuleValue,
} from '../../../src/types/modules';
import { buildV2Container } from '../../../src/utils/embed';
import { AutomodCase } from '../database/models/AutomodCase';
import {
	AUTOMOD_FEATURES,
	AutomodSetting,
	defaultAutomodFeatures,
	defaultAutomodPunishment,
	defaultAutomodThresholds,
	type AutomodFeature,
	type AutomodFeatures,
	type AutomodPunishment,
	type AutomodThresholds,
} from '../database/models/AutomodSetting';

interface SpamState {
	fastMessages: Message[];
	duplicateMessages: Message[];
	violations: number;
	lastPunishment: number;
	lastActivity: number;
}

export interface AutomodRuntimeSettings {
	features: AutomodFeatures;
	thresholds: AutomodThresholds;
	punishment: AutomodPunishment;
	badWords: string[];
	badwordWhitelist: string[];
	ignoredChannels: string[];
	whitelistUsers: string[];
	whitelistRoles: string[];
	allowedDomains: string[];
	logChannelId: string | null;
	auditLogChannelId: string | null;
}

const spamCache = new Map<string, SpamState>();

const leetMap: Record<string, string> = {
	'0': 'o',
	'1': 'i',
	'!': 'i',
	'3': 'e',
	'4': 'a',
	'@': 'a',
	'5': 's',
	$: 's',
	'7': 't',
	'+': 't',
	'8': 'b',
	'9': 'g',
};

const featureConfigMap: Record<AutomodFeature, keyof AutomodModuleConfig> = {
	antiSpam: 'spam',
	antiDuplicate: 'duplicates',
	antiBadword: 'badwords',
	antiInvites: 'invites',
	antiLinks: 'links',
	antiMentions: 'mentions',
	antiAllCaps: 'spam',
	antiEmojiSpam: 'spam',
	antiZalgo: 'zalgo',
};

const thresholdKeys = Object.keys(
	defaultAutomodThresholds(),
) as (keyof AutomodThresholds)[];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanFromModuleValue(value: ModuleValue): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}

	if (isRecord(value) && typeof value.enabled === 'boolean') {
		return value.enabled;
	}

	return undefined;
}

function stringArrayFromModuleValue(value: ModuleValue): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string');
	}

	if (isRecord(value)) {
		const words = value.words;
		if (Array.isArray(words)) {
			return words.filter((item): item is string => typeof item === 'string');
		}
	}

	return [];
}

function featureDefaultsFromConfig(
	config?: AutomodModuleConfig,
): AutomodFeatures {
	const features = defaultAutomodFeatures();
	if (!config) {
		return features;
	}

	for (const feature of AUTOMOD_FEATURES) {
		const configured = booleanFromModuleValue(
			config[featureConfigMap[feature]],
		);
		if (configured !== undefined) {
			features[feature] = configured;
		}
	}

	return features;
}

function thresholdsFromConfig(config?: AutomodModuleConfig): AutomodThresholds {
	const thresholds = defaultAutomodThresholds();
	if (!config) {
		return thresholds;
	}

	if (isRecord(config.spam)) {
		if (typeof config.spam.threshold === 'number') {
			thresholds.spamMessages = config.spam.threshold;
		}
		if (typeof config.spam.windowSeconds === 'number') {
			thresholds.spamWindowSeconds = config.spam.windowSeconds;
		}
	}

	if (isRecord(config.duplicates)) {
		if (typeof config.duplicates.threshold === 'number') {
			thresholds.duplicateMessages = config.duplicates.threshold;
		}
		if (typeof config.duplicates.windowSeconds === 'number') {
			thresholds.duplicateWindowSeconds = config.duplicates.windowSeconds;
		}
	}

	if (isRecord(config.mentions) && typeof config.mentions.max === 'number') {
		thresholds.mentionCount = config.mentions.max;
	}

	return thresholds;
}

function list(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string');
	}

	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown;
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(item): item is string => typeof item === 'string',
				);
			}
		} catch {
			return value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		}
	}

	return [];
}

function normalizeDomain(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/^www\./, '')
		.split('/')[0]
		.replace(/:\d+$/, '');
}

function normalizedList(
	value: unknown,
	options?: { domains?: boolean },
): string[] {
	const normalize = options?.domains
		? normalizeDomain
		: (item: string) => item.trim().toLowerCase();

	return [...new Set(list(value).map(normalize).filter(Boolean))];
}

export function normalizeText(text: string): string {
	return [...text.toLowerCase().normalize('NFKD')]
		.map((char) => leetMap[char] ?? char)
		.join('')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function escapeRegex(value: string): string {
	return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function wordPattern(word: string): string {
	return normalizeText(word)
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.split('').map(escapeRegex).join('\\s*'))
		.join('\\s+');
}

function contentForInspection(message: Message): string {
	return [
		message.content,
		...message.embeds.flatMap((embed) => [
			embed.title,
			embed.description,
			embed.url,
			embed.footer?.text,
			...embed.fields.map((field) => `${field.name} ${field.value}`),
		]),
		...message.attachments.map(
			(attachment) => attachment.name ?? attachment.url,
		),
	]
		.filter(
			(value): value is string => typeof value === 'string' && value.length > 0,
		)
		.join(' ');
}

function canDeleteMessage(message: Message): boolean {
	if (!message.guild?.members.me) {
		return false;
	}

	const channel = message.channel as {
		permissionsFor?: (member: GuildMember) => PermissionsBitField | null;
	} | null;
	const permissions =
		typeof channel?.permissionsFor === 'function'
			? channel.permissionsFor(message.guild.members.me)
			: null;
	return Boolean(
		permissions?.has([
			PermissionsBitField.Flags.ViewChannel,
			PermissionsBitField.Flags.ManageMessages,
		]),
	);
}

async function deleteMessages(
	messages: Message[],
	client: PriyxClient,
): Promise<void> {
	const uniqueMessages = new Map(
		messages.map((message) => [message.id, message]),
	);

	for (const message of uniqueMessages.values()) {
		if (!canDeleteMessage(message)) {
			continue;
		}

		await message.delete().catch((error: unknown) => {
			client.logger.warn('[automod] Failed to delete message:', error);
		});
	}
}

function compactForInviteDetection(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasDiscordInvite(value: string): boolean {
	const compact = compactForInviteDetection(value);
	return [
		'discordgg',
		'discordcominvite',
		'discordappcominvite',
		'discordappgg',
		'dscgg',
		'invitegg',
		'discgg',
		'discordme',
		'discordio',
		'discordlink',
		'joinmydiscordcom',
	].some((needle) => compact.includes(needle));
}

function extractDomains(value: string): string[] {
	const regex =
		/(?:(?:https?:\/\/)?(?:www\.)?)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?:\/[^\s]*)?/giu;
	return [...value.matchAll(regex)].map((match) => normalizeDomain(match[1]));
}

function isAllowedDomain(domain: string, allowedDomains: string[]): boolean {
	return allowedDomains.some(
		(allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
	);
}

function hasBlockedLink(value: string, allowedDomains: string[]): boolean {
	const shorteners = new Set([
		'bit.ly',
		'tinyurl.com',
		'goo.gl',
		't.co',
		'ow.ly',
		'is.gd',
		'cutt.ly',
		'rb.gy',
		'rebrand.ly',
		'shorturl.at',
		'shrtco.de',
		'j.mp',
		'linktr.ee',
	]);

	return extractDomains(value).some((domain) => {
		if (
			domain === 'cdn.discordapp.com' ||
			domain === 'media.discordapp.net' ||
			domain === 'images-ext-1.discordapp.net'
		) {
			return false;
		}

		return shorteners.has(domain) || !isAllowedDomain(domain, allowedDomains);
	});
}

function countEmojis(value: string): { total: number; ratio: number } {
	const unicodeEmojiRegex =
		/(?:[\u203C-\u3299]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
	const customEmojiRegex = /<a?:\w+:\d+>/g;
	const unicodeMatches = value.match(unicodeEmojiRegex) ?? [];
	const customMatches = value.match(customEmojiRegex) ?? [];
	const total = unicodeMatches.length + customMatches.length;

	return { total, ratio: total / Math.max(value.length, 1) };
}

function countZalgo(value: string): number {
	return value.match(/[\u0300-\u036f]/g)?.length ?? 0;
}

function allCapsRatio(value: string): number {
	const letters = [...value].filter((char) => /[A-Za-z]/.test(char));
	if (letters.length === 0) {
		return 0;
	}

	const uppercase = letters.filter(
		(char) => char === char.toUpperCase() && char !== char.toLowerCase(),
	);
	return uppercase.length / letters.length;
}

function mentionCount(message: Message): number {
	const everyoneHere = (message.content.match(/@everyone|@here/gi) ?? [])
		.length;
	const rawMentions = (
		message.content.match(/<@!?\d+>|<@&\d+>|[\uFF20]everyone|[\uFF20]here/gi) ??
		[]
	).length;
	return (
		message.mentions.users.size +
		message.mentions.roles.size +
		everyoneHere +
		rawMentions
	);
}

function findBadword(
	message: Message,
	settings: AutomodRuntimeSettings,
): string | null {
	if (settings.badWords.length === 0) {
		return null;
	}

	const rawContent = contentForInspection(message);
	const normalizedContent = normalizeText(rawContent);

	if (!normalizedContent) {
		return null;
	}

	const whitelist = settings.badwordWhitelist
		.map(normalizeText)
		.filter(Boolean);
	if (whitelist.some((word) => normalizedContent.includes(word))) {
		return null;
	}

	const patterns = settings.badWords.map(wordPattern).filter(Boolean);
	if (patterns.length === 0) {
		return null;
	}

	const regex = new RegExp(`(?:^|\\s)(${patterns.join('|')})(?:\\s|$)`, 'i');
	return normalizedContent.match(regex)?.[1] ?? null;
}

function ownerIds(): string[] {
	return (process.env.OWNER_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

async function isExempt(
	message: Message,
	settings: AutomodRuntimeSettings,
): Promise<boolean> {
	if (!message.guild || !message.member) {
		return true;
	}

	if (ownerIds().includes(message.author.id)) {
		return true;
	}

	if (settings.ignoredChannels.includes(message.channel.id)) {
		return true;
	}

	if (settings.whitelistUsers.includes(message.author.id)) {
		return true;
	}

	if (
		message.member.roles.cache.some((role) =>
			settings.whitelistRoles.includes(role.id),
		)
	) {
		return true;
	}

	return message.member.permissions.has([
		PermissionsBitField.Flags.Administrator,
		PermissionsBitField.Flags.ManageGuild,
	]);
}

async function timeoutMember(
	message: Message,
	seconds: number,
	reason: string,
	client: PriyxClient,
): Promise<void> {
	if (!message.guild || !message.member || seconds <= 0) {
		return;
	}

	if (
		!message.guild.members.me?.permissions.has(
			PermissionsBitField.Flags.ModerateMembers,
		)
	) {
		return;
	}

	await message.member
		.timeout(seconds * 1000, reason)
		.catch((error: unknown) => {
			client.logger.warn('[automod] Failed to timeout member:', error);
		});
}

async function logCase(
	client: PriyxClient,
	message: Message,
	settings: AutomodRuntimeSettings,
	reason: string,
	trigger: string,
	action: string,
): Promise<void> {
	if (!message.guild) {
		return;
	}

	await AutomodCase.create({
		guildId: message.guild.id,
		userId: message.author.id,
		data: {
			action,
			channelId: message.channel.id,
			messageId: message.id,
			reason,
			trigger: trigger.slice(0, 1000),
			userTag: message.author.tag,
		},
	}).catch((error: unknown) => {
		client.logger.warn('[automod] Failed to write case:', error);
	});

	if (!settings.logChannelId) {
		return;
	}

	const channel = await message.guild.channels
		.fetch(settings.logChannelId)
		.catch(() => null);
	if (!channel?.isTextBased()) {
		return;
	}

	await channel
		.send({
			components: [
				buildV2Container({
					title: 'Automod action',
					description: [
						`**Member:** ${message.author} (${message.author.id})`,
						`**Channel:** <#${message.channel.id}>`,
						`**Reason:** ${reason}`,
						`**Action:** ${action}`,
						`**Trigger:** ${trigger.slice(0, 700) || 'No message content'}`,
					].join('\n'),
					footer: 'Priyx automod',
				}),
			],
			flags: MessageFlags.IsComponentsV2,
		})
		.catch((error: unknown) => {
			client.logger.warn('[automod] Failed to send log:', error);
		});
}

async function punishMessage(
	client: PriyxClient,
	message: Message,
	settings: AutomodRuntimeSettings,
	reason: string,
	trigger = message.content,
	timeoutSeconds = 0,
): Promise<void> {
	await deleteMessages([message], client);
	await timeoutMember(message, timeoutSeconds, reason, client);
	await logCase(
		client,
		message,
		settings,
		reason,
		trigger,
		timeoutSeconds > 0 ? `delete + timeout ${timeoutSeconds}s` : 'delete',
	);
}

async function checkSpam(
	client: PriyxClient,
	message: Message,
	settings: AutomodRuntimeSettings,
): Promise<boolean> {
	if (!settings.features.antiSpam && !settings.features.antiDuplicate) {
		return false;
	}

	const now = Date.now();
	const key = `${message.guild?.id}:${message.author.id}`;
	const state =
		spamCache.get(key) ??
		({
			fastMessages: [],
			duplicateMessages: [],
			violations: 0,
			lastPunishment: 0,
			lastActivity: now,
		} satisfies SpamState);

	state.lastActivity = now;
	state.fastMessages = [...state.fastMessages, message].filter(
		(item) =>
			now - item.createdTimestamp <=
			settings.thresholds.spamWindowSeconds * 1000,
	);
	state.duplicateMessages = [...state.duplicateMessages, message].filter(
		(item) =>
			now - item.createdTimestamp <=
			settings.thresholds.duplicateWindowSeconds * 1000,
	);

	let reason: string | null = null;
	let messagesToDelete: Message[] = [];

	if (settings.features.antiDuplicate && message.content.trim().length > 0) {
		const duplicateMessages = state.duplicateMessages.filter(
			(item) => item.content.toLowerCase() === message.content.toLowerCase(),
		);
		if (duplicateMessages.length >= settings.thresholds.duplicateMessages) {
			reason = 'Duplicate message spam';
			messagesToDelete = duplicateMessages;
		}
	}

	if (
		!reason &&
		settings.features.antiSpam &&
		state.fastMessages.length >= settings.thresholds.spamMessages
	) {
		reason = 'Fast message spam';
		messagesToDelete = state.fastMessages;
	}

	if (
		!reason &&
		settings.features.antiSpam &&
		state.fastMessages.filter((item) => {
			const length = item.content.trim().length;
			return length > 0 && length <= 5;
		}).length >= settings.thresholds.shortMessages
	) {
		reason = 'Short message spam';
		messagesToDelete = state.fastMessages;
	}

	if (!reason) {
		spamCache.set(key, state);
		return false;
	}

	state.violations += 1;
	state.lastPunishment = now;
	const timeoutSeconds = Math.min(
		settings.punishment.timeoutSeconds * state.violations,
		settings.punishment.maxTimeoutSeconds,
	);
	await deleteMessages(messagesToDelete, client);
	await timeoutMember(message, timeoutSeconds, reason, client);
	await logCase(
		client,
		message,
		settings,
		reason,
		message.content,
		`delete ${messagesToDelete.length} + timeout ${timeoutSeconds}s`,
	);

	state.fastMessages = [];
	state.duplicateMessages = [];
	spamCache.set(key, state);
	return true;
}

function runtimeSettings(setting: AutomodSetting): AutomodRuntimeSettings {
	return {
		features: {
			...defaultAutomodFeatures(),
			...(isRecord(setting.features) ? setting.features : {}),
		},
		thresholds: {
			...defaultAutomodThresholds(),
			...(isRecord(setting.thresholds) ? setting.thresholds : {}),
		},
		punishment: {
			...defaultAutomodPunishment(),
			...(isRecord(setting.punishment) ? setting.punishment : {}),
		},
		badWords: normalizedList(setting.badWords),
		badwordWhitelist: normalizedList(setting.badwordWhitelist),
		ignoredChannels: normalizedList(setting.ignoredChannels),
		whitelistUsers: normalizedList(setting.whitelistUsers),
		whitelistRoles: normalizedList(setting.whitelistRoles),
		allowedDomains: normalizedList(setting.allowedDomains, { domains: true }),
		logChannelId: setting.logChannelId ?? null,
		auditLogChannelId: setting.auditLogChannelId ?? null,
	};
}

async function getSetting(
	guildId: string,
	config?: AutomodModuleConfig,
): Promise<AutomodSetting> {
	const [setting] = await AutomodSetting.findOrCreate({
		where: { guildId },
		defaults: {
			guildId,
			features: featureDefaultsFromConfig(config),
			thresholds: thresholdsFromConfig(config),
			punishment: defaultAutomodPunishment(),
			badWords: stringArrayFromModuleValue(config?.badwords).map((word) =>
				word.toLowerCase(),
			),
			badwordWhitelist: [],
			ignoredChannels: [],
			whitelistUsers: [],
			whitelistRoles: [],
			allowedDomains: [],
			logChannelId: null,
			auditLogChannelId: null,
		},
	});
	return setting;
}

async function inspectMessage(
	client: PriyxClient,
	message: Message,
	config?: AutomodModuleConfig,
): Promise<boolean> {
	if (!message.guild || message.author.bot) {
		return false;
	}

	const setting = await getSetting(message.guild.id, config);
	const settings = runtimeSettings(setting);

	if (await isExempt(message, settings)) {
		return false;
	}

	if (await checkSpam(client, message, settings)) {
		return true;
	}

	const inspectionContent = contentForInspection(message);

	if (settings.features.antiBadword) {
		const match = findBadword(message, settings);
		if (match) {
			await punishMessage(
				client,
				message,
				settings,
				`Blocked word: ${match}`,
				match,
			);
			return true;
		}
	}

	if (settings.features.antiInvites && hasDiscordInvite(inspectionContent)) {
		await punishMessage(client, message, settings, 'Discord invite detected');
		return true;
	}

	if (
		settings.features.antiLinks &&
		hasBlockedLink(inspectionContent, settings.allowedDomains)
	) {
		await punishMessage(client, message, settings, 'Blocked link detected');
		return true;
	}

	if (
		settings.features.antiMentions &&
		mentionCount(message) >= settings.thresholds.mentionCount
	) {
		await punishMessage(client, message, settings, 'Mention spam detected');
		return true;
	}

	if (
		settings.features.antiAllCaps &&
		message.content.length >= settings.thresholds.allCapsMinLength &&
		allCapsRatio(message.content) >= settings.thresholds.allCapsRatio
	) {
		await punishMessage(client, message, settings, 'All caps spam detected');
		return true;
	}

	if (settings.features.antiEmojiSpam) {
		const emojis = countEmojis(message.content);
		if (
			emojis.total >= settings.thresholds.emojiMinTotal ||
			emojis.ratio >= settings.thresholds.emojiRatio
		) {
			await punishMessage(client, message, settings, 'Emoji spam detected');
			return true;
		}
	}

	if (
		settings.features.antiZalgo &&
		countZalgo(message.content) >= settings.thresholds.zalgoMarks
	) {
		await punishMessage(client, message, settings, 'Zalgo text detected');
		return true;
	}

	return false;
}

function cleanupSpamCache(): void {
	const now = Date.now();
	for (const [key, state] of spamCache.entries()) {
		if (now - state.lastActivity > 60 * 60 * 1000) {
			spamCache.delete(key);
		}
	}
}

setInterval(cleanupSpamCache, 60 * 60 * 1000).unref();

export const AutomodHelper = {
	featureConfigMap,
	getSetting,
	inspectMessage,
	normalizeDomain,
	normalizedList,
	runtimeSettings,
	thresholdKeys,
};
