import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import http, {
	type IncomingMessage,
	type ServerResponse,
	type Server,
} from 'node:http';
import path from 'node:path';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	ContainerBuilder,
	MessageFlags,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	type Guild,
	type GuildTextBasedChannel,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import {
	RainlinkLoopMode,
	type RainlinkPlayer,
	type RainlinkTrack,
} from 'rainlink';
import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';
import {
	moduleNames,
	type ApiModuleConfig,
	type MusicModuleConfig,
	type ModuleName,
	type ModuleValue,
} from '../../src/types/modules';
import {
	createOrGetMusicPlayer,
	cycleLoop,
	ensureMusicPlayback,
	endLivePlayer,
	fetchRecommendations,
	formatTrackDuration,
	getMusicPlayer,
	getMusicState,
	isMusicIdAllowed,
	loopModeFromConfig,
	postSongRequestPanel,
	setupRainlink,
	updateLivePlayer,
} from '../music/helpers';

interface DiscordUser {
	id: string;
	username: string;
	global_name?: string | null;
	avatar?: string | null;
}

interface DiscordOAuthGuild {
	id: string;
	name: string;
	icon?: string | null;
	owner?: boolean;
	permissions?: string;
}

interface DashboardGuild {
	id: string;
	name: string;
	iconUrl?: string;
	owner: boolean;
	manageable: boolean;
	botInGuild: boolean;
	memberCount?: number;
}

interface DashboardSession {
	token: string;
	user: DiscordUser;
	guilds: DiscordOAuthGuild[];
	accessToken: string;
	createdAt: number;
	expiresAt: number;
}

interface OAuthState {
	redirect: string;
	expiresAt: number;
}

interface RequestContext {
	client: PriyxClient;
	config: Required<ApiModuleConfig>;
	url: URL;
}

const sessions = new Map<string, DashboardSession>();
const oauthStates = new Map<string, OAuthState>();
const bannedUserIds = new Set<string>();
const manageGuildBit = 0x20n;
const administratorBit = 0x8n;

const configurableModules = moduleNames.filter(
	(moduleName) => !['bot', 'colors', 'presence', 'api'].includes(moduleName),
);

const moduleMeta: Partial<
	Record<
		ModuleName,
		{
			label: string;
			description: string;
			category: 'configuration' | 'safety' | 'engagement' | 'utility';
			icon: string;
			accent: string;
		}
	>
> = {
	core: {
		label: 'Core',
		description: 'Moderation, utility commands, and server settings.',
		category: 'configuration',
		icon: 'grid',
		accent: '#8b6dff',
	},
	automod: {
		label: 'Automod',
		description: 'Automatically moderate and filter server content.',
		category: 'safety',
		icon: 'shield',
		accent: '#3dd6ae',
	},
	ticket: {
		label: 'Tickets',
		description: 'Create support panels and private ticket channels.',
		category: 'engagement',
		icon: 'ticket',
		accent: '#8b6dff',
	},
	music: {
		label: 'Music',
		description: 'Lavalink playback, filters, queues, and live players.',
		category: 'engagement',
		icon: 'music',
		accent: '#28d17c',
	},
	suggestion: {
		label: 'Suggestions',
		description: 'Collect ideas and let moderators review votes.',
		category: 'engagement',
		icon: 'message',
		accent: '#3be477',
	},
	welcomer: {
		label: 'Welcome',
		description: 'Send custom welcome and farewell messages.',
		category: 'engagement',
		icon: 'user-plus',
		accent: '#ff6978',
	},
	leveling: {
		label: 'Leveling',
		description: 'Reward chat activity with XP, ranks, and roles.',
		category: 'engagement',
		icon: 'chart',
		accent: '#f0c84b',
	},
	giveaway: {
		label: 'Giveaways',
		description: 'Run giveaways with rerolls and timed winners.',
		category: 'engagement',
		icon: 'gift',
		accent: '#ff9f43',
	},
	'reaction-role': {
		label: 'Reaction Roles',
		description: 'Let members pick roles from message components.',
		category: 'configuration',
		icon: 'roles',
		accent: '#8b6dff',
	},
	tempvoice: {
		label: 'Voice Rooms',
		description: 'Create temporary voice channels automatically.',
		category: 'engagement',
		icon: 'voice',
		accent: '#6bc7ff',
	},
	verification: {
		label: 'Verification',
		description: 'Gate server access with button or captcha flows.',
		category: 'safety',
		icon: 'lock',
		accent: '#56c9ff',
	},
	ai: {
		label: 'AI',
		description: 'AI assistant tools and controlled server prompts.',
		category: 'utility',
		icon: 'spark',
		accent: '#d66dff',
	},
	economy: {
		label: 'Economy',
		description: 'Currency, shop, jobs, rewards, and gambling.',
		category: 'engagement',
		icon: 'coin',
		accent: '#f7ce46',
	},
	globalchat: {
		label: 'Global Chat',
		description: 'Bridge community chats across configured servers.',
		category: 'engagement',
		icon: 'globe',
		accent: '#49d6ff',
	},
	autoreact: {
		label: 'Auto React',
		description: 'React to messages based on server rules.',
		category: 'utility',
		icon: 'emoji',
		accent: '#f58cff',
	},
	autoreply: {
		label: 'Auto Reply',
		description: 'Send automatic replies to configured triggers.',
		category: 'utility',
		icon: 'reply',
		accent: '#8b6dff',
	},
	'embed-builder': {
		label: 'Embed Builder',
		description: 'Build and save rich message embeds.',
		category: 'utility',
		icon: 'box',
		accent: '#b08cff',
	},
	image: {
		label: 'Image',
		description: 'Image generation and utility commands.',
		category: 'utility',
		icon: 'image',
		accent: '#ff8f70',
	},
	streak: {
		label: 'Streaks',
		description: 'Track streak activity and reward consistency.',
		category: 'engagement',
		icon: 'flame',
		accent: '#ff715b',
	},
	'social-alerts': {
		label: 'Social Alerts',
		description: 'Notify channels when tracked social accounts post.',
		category: 'engagement',
		icon: 'bell',
		accent: '#6c63ff',
	},
	adventure: {
		label: 'Adventure',
		description: 'RPG profiles, exploration, and progression.',
		category: 'engagement',
		icon: 'map',
		accent: '#40cf7a',
	},
	pet: {
		label: 'Pets',
		description: 'Collect, care for, and level server pets.',
		category: 'engagement',
		icon: 'paw',
		accent: '#f7b955',
	},
	fun: {
		label: 'Fun',
		description: 'Games, social commands, and lighter interactions.',
		category: 'engagement',
		icon: 'star',
		accent: '#ffe36a',
	},
	birthday: {
		label: 'Birthdays',
		description: 'Track birthdays and send server celebrations.',
		category: 'engagement',
		icon: 'cake',
		accent: '#ff76a8',
	},
	invite: {
		label: 'Invites',
		description: 'Track invites, fake joins, and leaderboards.',
		category: 'safety',
		icon: 'invite',
		accent: '#6c9cff',
	},
};

interface ApiAdminState {
	bannedUserIds?: string[];
}

function adminStatePath(): string {
	return path.resolve(process.cwd(), 'data', 'api-admin-state.json');
}

async function loadAdminState(): Promise<void> {
	try {
		const raw = await fs.readFile(adminStatePath(), 'utf8');
		const parsed = JSON.parse(raw) as ApiAdminState;
		bannedUserIds.clear();
		for (const userId of parsed.bannedUserIds ?? []) {
			if (typeof userId === 'string' && userId.length > 0) {
				bannedUserIds.add(userId);
			}
		}
	} catch {
		bannedUserIds.clear();
	}
}

async function saveAdminState(): Promise<void> {
	await fs.mkdir(path.dirname(adminStatePath()), { recursive: true });
	await fs.writeFile(
		adminStatePath(),
		JSON.stringify(
			{ bannedUserIds: [...bannedUserIds].sort() } satisfies ApiAdminState,
			null,
			2,
		),
		'utf8',
	);
}

function revokeUserSessions(userId: string): void {
	for (const [token, session] of sessions.entries()) {
		if (session.user.id === userId) {
			sessions.delete(token);
		}
	}
}

function withDefaults(config?: ApiModuleConfig): Required<ApiModuleConfig> {
	const host = String(config?.host ?? '127.0.0.1');
	const port = Number(config?.port ?? 8787);
	const publicUrl = String(config?.publicUrl ?? `http://localhost:${port}`);
	const dashboardUrl = String(config?.dashboardUrl ?? 'http://localhost:5173');
	const dashboardProxyCallback = `${dashboardUrl.replace(
		/\/+$/,
		'',
	)}/api/priyx/auth/callback`;
	return {
		enabled: Boolean(config?.enabled ?? false),
		host,
		port,
		publicUrl,
		dashboardUrl,
		corsOrigin: String(config?.corsOrigin ?? dashboardUrl),
		sessionTtl: Number(config?.sessionTtl ?? 86_400),
		invitePermissions: String(config?.invitePermissions ?? '8'),
		oauthRedirectUri: String(
			config?.oauthRedirectUri ?? dashboardProxyCallback,
		),
		requireApiKey: Boolean(config?.requireApiKey ?? true),
	};
}

function headerValue(req: IncomingMessage | undefined, name: string): string {
	const header = req?.headers[name.toLowerCase()];
	return Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
}

function trustedProxyHeader(
	req: IncomingMessage | undefined,
	name: string,
): string {
	const expected = apiKey();
	if (!req || !expected || apiKeyHeader(req) !== expected) {
		return '';
	}

	return headerValue(req, name);
}

function clientId(req?: IncomingMessage): string {
	return (
		trustedProxyHeader(req, 'x-priyx-discord-client-id') ||
		process.env.CLIENT_ID ||
		process.env.DISCORD_CLIENT_ID ||
		''
	);
}

function clientSecret(req?: IncomingMessage): string {
	return (
		trustedProxyHeader(req, 'x-priyx-discord-client-secret') ||
		process.env.DISCORD_CLIENT_SECRET ||
		''
	);
}

function apiKey(): string {
	return process.env.PRIYX_API_KEY ?? '';
}

function apiKeyHeader(req: IncomingMessage): string {
	const header = req.headers['x-priyx-api-key'];
	return Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
}

function isPublicApiRoute(path: string): boolean {
	return (
		path === '/api/health' ||
		path === '/api/auth/discord' ||
		path === '/api/auth/callback'
	);
}

function hasApiAccess(
	req: IncomingMessage,
	config: Required<ApiModuleConfig>,
	path: string,
): boolean {
	if (!config.requireApiKey || isPublicApiRoute(path)) {
		return true;
	}

	const expected = apiKey();
	if (!expected) {
		return true;
	}

	return apiKeyHeader(req) === expected;
}

function userAvatarUrl(user: DiscordUser): string | undefined {
	if (!user.avatar) {
		return undefined;
	}

	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function guildIconUrl(guild: DiscordOAuthGuild): string | undefined {
	if (!guild.icon) {
		return undefined;
	}

	const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

function canManageGuild(guild: DiscordOAuthGuild): boolean {
	if (guild.owner) {
		return true;
	}

	const permissions = BigInt(guild.permissions ?? '0');
	return (
		(permissions & manageGuildBit) === manageGuildBit ||
		(permissions & administratorBit) === administratorBit
	);
}

function serializeOAuthGuild(
	client: PriyxClient,
	guild: DiscordOAuthGuild,
): DashboardGuild {
	const botGuild = client.guilds.cache.get(guild.id);
	return {
		id: guild.id,
		name: guild.name,
		iconUrl: guildIconUrl(guild),
		owner: Boolean(guild.owner),
		manageable: canManageGuild(guild),
		botInGuild: Boolean(botGuild),
		memberCount: botGuild?.memberCount,
	};
}

function inviteUrl(
	config: Required<ApiModuleConfig>,
	guildId?: string,
): string {
	const id = clientId();
	const url = new URL('https://discord.com/oauth2/authorize');
	url.searchParams.set('client_id', id);
	url.searchParams.set('permissions', config.invitePermissions);
	url.searchParams.set('scope', 'bot applications.commands');
	if (guildId) {
		url.searchParams.set('guild_id', guildId);
		url.searchParams.set('disable_guild_select', 'true');
	}
	return url.toString();
}

function setCors(
	req: IncomingMessage,
	res: ServerResponse,
	config: Required<ApiModuleConfig>,
): void {
	const requestOrigin =
		typeof req.headers.origin === 'string' ? req.headers.origin : '';
	const allowed = config.corsOrigin
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	const allowOrigin =
		allowed.includes('*') || allowed.length === 0
			? requestOrigin || '*'
			: allowed.includes(requestOrigin)
				? requestOrigin
				: allowed[0];

	res.setHeader('Access-Control-Allow-Origin', allowOrigin);
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, X-Priyx-Api-Key',
	);
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
	res.setHeader('Vary', 'Origin');
}

function sendJson(
	res: ServerResponse,
	status: number,
	payload: unknown,
	headers: Record<string, string> = {},
): void {
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		...headers,
	});
	res.end(JSON.stringify(payload));
}

function runBackgroundMusicTask(
	client: PriyxClient,
	label: string,
	task: Promise<unknown>,
): void {
	void task.catch((error) => {
		client.addonLogger('api').warn(`${label} failed:`, error);
	});
}

function destroyEmptyDashboardPlayer(
	client: PriyxClient,
	player: RainlinkPlayer,
	label: string,
): void {
	if (player.queue.current || player.queue.size > 0 || player.playing) {
		return;
	}

	client.rainlink?.players.delete(player.guildId);
	runBackgroundMusicTask(client, label, player.destroy());
}

function redirect(res: ServerResponse, location: string, headers = {}): void {
	res.writeHead(302, { Location: location, ...headers });
	res.end();
}

function parseCookies(req: IncomingMessage): Record<string, string> {
	const raw = req.headers.cookie;
	if (!raw) {
		return {};
	}

	return raw.split(';').reduce<Record<string, string>>((cookies, part) => {
		const [key, ...value] = part.trim().split('=');
		if (key) {
			cookies[key] = decodeURIComponent(value.join('='));
		}
		return cookies;
	}, {});
}

function bearerToken(req: IncomingMessage): string | undefined {
	const auth = req.headers.authorization;
	if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
		return auth.slice('Bearer '.length);
	}

	return undefined;
}

function sessionFromRequest(req: IncomingMessage): DashboardSession | null {
	const token = bearerToken(req) ?? parseCookies(req).priyx_session;
	if (!token) {
		return null;
	}

	const session = sessions.get(token);
	if (!session || session.expiresAt < Date.now()) {
		sessions.delete(token);
		return null;
	}

	if (bannedUserIds.has(session.user.id)) {
		sessions.delete(token);
		return null;
	}

	return session;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.byteLength;
		if (size > 1_000_000) {
			throw new Error('Request body is too large.');
		}
		chunks.push(buffer);
	}

	if (chunks.length === 0) {
		return {};
	}

	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function discordFetch<T>(path: string, token: string): Promise<T> {
	const response = await fetch(`https://discord.com/api/v10${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		throw new Error(`Discord API request failed: ${response.status}`);
	}

	return (await response.json()) as T;
}

async function exchangeCode(
	config: Required<ApiModuleConfig>,
	code: string,
	req?: IncomingMessage,
): Promise<{ access_token: string; expires_in?: number }> {
	const id = clientId(req);
	const secret = clientSecret(req);
	if (!id || !secret) {
		throw new Error('CLIENT_ID and DISCORD_CLIENT_SECRET are required.');
	}

	const response = await fetch('https://discord.com/api/v10/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: id,
			client_secret: secret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: config.oauthRedirectUri,
		}),
	});

	if (!response.ok) {
		throw new Error(`OAuth token exchange failed: ${response.status}`);
	}

	return (await response.json()) as {
		access_token: string;
		expires_in?: number;
	};
}

function safeRedirect(
	config: Required<ApiModuleConfig>,
	redirectTarget?: string | null,
): string {
	if (!redirectTarget) {
		return `${config.dashboardUrl}/servers`;
	}

	if (redirectTarget.startsWith('/')) {
		return `${config.dashboardUrl}${redirectTarget}`;
	}

	try {
		const parsed = new URL(redirectTarget);
		if (parsed.origin === new URL(config.dashboardUrl).origin) {
			return parsed.toString();
		}
	} catch {
		return `${config.dashboardUrl}/servers`;
	}

	return `${config.dashboardUrl}/servers`;
}

async function startOAuth(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
) {
	const id = clientId(req);
	if (!id) {
		sendJson(res, 500, { error: 'CLIENT_ID is missing.' });
		return;
	}

	const state = randomBytes(16).toString('hex');
	oauthStates.set(state, {
		redirect: safeRedirect(ctx.config, ctx.url.searchParams.get('redirect')),
		expiresAt: Date.now() + 10 * 60_000,
	});

	const url = new URL('https://discord.com/oauth2/authorize');
	url.searchParams.set('client_id', id);
	url.searchParams.set('redirect_uri', ctx.config.oauthRedirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'identify guilds');
	url.searchParams.set('state', state);
	redirect(res, url.toString());
}

async function finishOAuth(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
) {
	const code = ctx.url.searchParams.get('code');
	const state = ctx.url.searchParams.get('state');
	const storedState = state ? oauthStates.get(state) : undefined;
	if (!code || !state || !storedState || storedState.expiresAt < Date.now()) {
		sendJson(res, 400, { error: 'Invalid or expired OAuth state.' });
		return;
	}
	oauthStates.delete(state);

	const token = await exchangeCode(ctx.config, code, req);
	const [user, guilds] = await Promise.all([
		discordFetch<DiscordUser>('/users/@me', token.access_token),
		discordFetch<DiscordOAuthGuild[]>('/users/@me/guilds', token.access_token),
	]);

	if (bannedUserIds.has(user.id)) {
		redirect(res, `${ctx.config.dashboardUrl}/login?error=banned`);
		return;
	}

	const sessionToken = randomBytes(32).toString('hex');
	const ttlMs =
		Math.min(token.expires_in ?? ctx.config.sessionTtl, ctx.config.sessionTtl) *
		1000;
	sessions.set(sessionToken, {
		token: sessionToken,
		user,
		guilds,
		accessToken: token.access_token,
		createdAt: Date.now(),
		expiresAt: Date.now() + ttlMs,
	});

	redirect(res, storedState.redirect, {
		'Set-Cookie': `priyx_session=${encodeURIComponent(
			sessionToken,
		)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}`,
	});
}

function sendAuthMe(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
): void {
	const session = sessionFromRequest(req);
	if (!session) {
		sendJson(res, 401, { error: 'Not authenticated.' });
		return;
	}

	const guilds = session.guilds
		.filter(canManageGuild)
		.map((guild) => serializeOAuthGuild(ctx.client, guild));
	sendJson(res, 200, {
		user: {
			id: session.user.id,
			username: session.user.username,
			displayName: session.user.global_name ?? session.user.username,
			avatarUrl: userAvatarUrl(session.user),
		},
		guilds,
	});
}

function sendLogout(req: IncomingMessage, res: ServerResponse): void {
	const token = bearerToken(req) ?? parseCookies(req).priyx_session;
	if (token) {
		sessions.delete(token);
	}

	sendJson(
		res,
		200,
		{ ok: true },
		{
			'Set-Cookie': 'priyx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
		},
	);
}

function serializeSession(session: DashboardSession) {
	return {
		token: session.token.slice(0, 8),
		user: {
			id: session.user.id,
			username: session.user.username,
			displayName: session.user.global_name ?? session.user.username,
			avatarUrl: userAvatarUrl(session.user),
			banned: bannedUserIds.has(session.user.id),
		},
		guildCount: session.guilds.length,
		manageableGuildCount: session.guilds.filter(canManageGuild).length,
		createdAt: new Date(session.createdAt).toISOString(),
		expiresAt: new Date(session.expiresAt).toISOString(),
	};
}

function uniqueDashboardUsers() {
	const users = new Map<
		string,
		ReturnType<typeof serializeSession>['user'] & {
			sessionCount: number;
			guildCount: number;
			manageableGuildCount: number;
			lastSeenAt: string;
		}
	>();

	for (const session of sessions.values()) {
		const existing = users.get(session.user.id);
		const displayName = session.user.global_name ?? session.user.username;
		const guildCount = session.guilds.length;
		const manageableGuildCount = session.guilds.filter(canManageGuild).length;
		if (!existing) {
			users.set(session.user.id, {
				id: session.user.id,
				username: session.user.username,
				displayName,
				avatarUrl: userAvatarUrl(session.user),
				banned: bannedUserIds.has(session.user.id),
				sessionCount: 1,
				guildCount,
				manageableGuildCount,
				lastSeenAt: new Date(session.createdAt).toISOString(),
			});
			continue;
		}

		existing.sessionCount += 1;
		existing.guildCount = Math.max(existing.guildCount, guildCount);
		existing.manageableGuildCount = Math.max(
			existing.manageableGuildCount,
			manageableGuildCount,
		);
		if (session.createdAt > Date.parse(existing.lastSeenAt)) {
			existing.lastSeenAt = new Date(session.createdAt).toISOString();
		}
	}

	for (const userId of bannedUserIds) {
		if (!users.has(userId)) {
			users.set(userId, {
				id: userId,
				username: userId,
				displayName: userId,
				avatarUrl: undefined,
				banned: true,
				sessionCount: 0,
				guildCount: 0,
				manageableGuildCount: 0,
				lastSeenAt: '',
			});
		}
	}

	return [...users.values()].sort((left, right) =>
		left.displayName.localeCompare(right.displayName),
	);
}

async function requireGuild(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<{ session: DashboardSession; guild: Guild } | null> {
	const session = sessionFromRequest(req);
	if (!session) {
		sendJson(res, 401, { error: 'Not authenticated.' });
		return null;
	}

	const userGuild = session.guilds.find((guild) => guild.id === guildId);
	if (!userGuild || !canManageGuild(userGuild)) {
		sendJson(res, 403, { error: 'You cannot manage this server.' });
		return null;
	}

	const guild =
		ctx.client.guilds.cache.get(guildId) ??
		(await ctx.client.guilds.fetch(guildId).catch(() => null));
	if (!guild) {
		sendJson(res, 409, { error: 'Priyx is not in this server.' });
		return null;
	}

	return { session, guild };
}

async function serializeGuildDetails(guild: Guild) {
	const [channels, roles] = await Promise.all([
		guild.channels.fetch().catch(() => guild.channels.cache),
		guild.roles.fetch().catch(() => guild.roles.cache),
	]);

	return {
		id: guild.id,
		name: guild.name,
		iconUrl: guild.iconURL({ size: 128 }) ?? undefined,
		memberCount: guild.memberCount,
		ownerId: guild.ownerId,
		channels: [...channels.values()]
			.filter(Boolean)
			.map((channel) => ({
				id: channel!.id,
				name: channel!.name,
				type: channel!.type,
				parentId: 'parentId' in channel! ? channel!.parentId : null,
				position: 'position' in channel! ? channel!.position : 0,
			}))
			.sort((left, right) => left.position - right.position),
		categories: [...channels.values()]
			.filter((channel) => channel?.type === ChannelType.GuildCategory)
			.map((channel) => ({
				id: channel!.id,
				name: channel!.name,
				position: 'position' in channel! ? channel!.position : 0,
			}))
			.sort((left, right) => left.position - right.position),
		roles: [...roles.values()]
			.filter((role) => role.id !== guild.id)
			.map((role) => ({
				id: role.id,
				name: role.name,
				color: role.hexColor,
				position: role.position,
				managed: role.managed,
			}))
			.sort((left, right) => right.position - left.position),
	};
}

async function modulePayload(client: PriyxClient, guildId: string) {
	return Promise.all(
		configurableModules.map(async (moduleName) => {
			const config = await client.guildModule(guildId, moduleName);
			const meta = moduleMeta[moduleName] ?? {
				label: moduleName,
				description: `Configure ${moduleName}.`,
				category: 'utility' as const,
				icon: 'grid',
				accent: '#8b6dff',
			};
			return {
				name: moduleName,
				...meta,
				enabled: 'enabled' in config ? Boolean(config.enabled) : true,
				config,
			};
		}),
	);
}

async function sendGuild(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const [guild, modules] = await Promise.all([
		serializeGuildDetails(access.guild),
		modulePayload(ctx.client, guildId),
	]);
	sendJson(res, 200, {
		guild,
		modules,
		stats: {
			members: access.guild.memberCount,
			growth: null,
		},
		prefix: ctx.client.module('bot').prefix,
		notifications: [],
	});
}

async function sendModules(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	sendJson(res, 200, { modules: await modulePayload(ctx.client, guildId) });
}

function isConfigRecord(value: unknown): value is Record<string, ModuleValue> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfigurableModule(value: string): value is ModuleName {
	return (configurableModules as readonly string[]).includes(value);
}

async function patchModule(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
	moduleName: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	if (!isConfigurableModule(moduleName)) {
		sendJson(res, 404, { error: 'Unknown configurable module.' });
		return;
	}

	const body = await readJson(req);
	if (!isConfigRecord(body)) {
		sendJson(res, 400, { error: 'Request body must be a JSON object.' });
		return;
	}

	if (typeof body.enabled === 'boolean') {
		await ctx.client.setGuildModuleEnabled(guildId, moduleName, body.enabled);
	}

	if (isConfigRecord(body.config)) {
		await ctx.client.updateGuildModuleConfig(guildId, moduleName, body.config);
	}

	const config = await ctx.client.guildModule(guildId, moduleName);
	if (moduleName === 'music') {
		const songRequests = songRequestsConfig(config as MusicModuleConfig);
		const channelId = String(songRequests.channel ?? '').trim();
		if (songRequests.enabled !== false && channelId) {
			await postSongRequestPanelSafe(
				ctx.client,
				guildId,
				channelId,
				config as MusicModuleConfig,
			).catch((error) => {
				ctx.client
					.addonLogger('api')
					.warn('Failed to update song request panel:', error);
			});
		}
	}
	sendJson(res, 200, {
		module: {
			name: moduleName,
			enabled: 'enabled' in config ? Boolean(config.enabled) : true,
			config,
		},
	});
}

function isRecordValue(value: unknown): value is Record<string, ModuleValue> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requesterId(track?: RainlinkTrack | null): string | null {
	const requester = track?.requester;
	return typeof requester === 'object' &&
		requester !== null &&
		'id' in requester &&
		typeof requester.id === 'string'
		? requester.id
		: null;
}

function validYoutubeId(value: string | null | undefined): string | null {
	const id = String(value ?? '').trim();
	return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function youtubeIdFromUrl(value: string | null | undefined): string | null {
	const raw = String(value ?? '').trim();
	if (!raw) {
		return null;
	}

	try {
		const url = new URL(raw);
		const host = url.hostname.toLowerCase().replace(/^www\./, '');
		if (host === 'youtu.be') {
			return validYoutubeId(url.pathname.split('/').filter(Boolean)[0]);
		}

		if (host.endsWith('youtube.com') || host.endsWith('music.youtube.com')) {
			const direct = validYoutubeId(url.searchParams.get('v'));
			if (direct) {
				return direct;
			}

			const [section, id] = url.pathname.split('/').filter(Boolean);
			if (['embed', 'shorts', 'live'].includes(section ?? '')) {
				return validYoutubeId(id);
			}
		}
	} catch {
		return null;
	}

	return null;
}

function musicArtworkUrl(track: RainlinkTrack): string | null {
	const direct = String(track.artworkUrl ?? '').trim();
	if (direct) {
		return direct;
	}

	const uri = track.uri || track.realUri || null;
	const youtubeId =
		youtubeIdFromUrl(uri) || (uri ? null : validYoutubeId(track.identifier));
	return youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null;
}

function serializeMusicTrack(
	track: RainlinkTrack | null | undefined,
	index?: number,
) {
	if (!track) {
		return null;
	}

	return {
		index,
		identifier: track.identifier ?? null,
		title: track.title ?? 'Unknown track',
		author: track.author ?? 'Unknown artist',
		duration: track.duration ?? 0,
		durationLabel: track.isStream
			? 'Live'
			: formatTrackDuration(track.duration),
		isStream: Boolean(track.isStream),
		uri: track.uri || track.realUri || null,
		artworkUrl: musicArtworkUrl(track),
		requesterId: requesterId(track),
	};
}

interface LrclibLyrics {
	id?: number;
	trackName?: string;
	artistName?: string;
	albumName?: string;
	duration?: number;
	instrumental?: boolean;
	plainLyrics?: string | null;
	syncedLyrics?: string | null;
}

function cleanLyricsTrackName(value: string): string {
	return value
		.replace(/\s*\((official\s+)?(music\s+)?video\)\s*/gi, ' ')
		.replace(/\s*\[(official\s+)?(music\s+)?video\]\s*/gi, ' ')
		.replace(/\s*\((official\s+)?audio\)\s*/gi, ' ')
		.replace(/\s*\[(official\s+)?audio\]\s*/gi, ' ')
		.replace(/\s*\((lyrics?|visualizer|sped up|slowed|nightcore)\)\s*/gi, ' ')
		.replace(/\s*-\s*(official\s+)?(music\s+)?video\s*$/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanLyricsArtistName(value: string): string {
	return value
		.replace(/\s*-\s*topic\s*$/gi, '')
		.replace(/\s*vevo\s*$/gi, '')
		.replace(/\s+official\s*$/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function lyricsKey(value?: string | null): string {
	return cleanLyricsTrackName(String(value ?? ''))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function bestLyricsResult(
	results: LrclibLyrics[],
	trackName: string,
	artistName: string,
	durationSeconds: number | null,
): LrclibLyrics | null {
	const wantedTrack = lyricsKey(trackName);
	const wantedArtist = lyricsKey(artistName);
	const scored = results
		.filter((item) => item.syncedLyrics || item.plainLyrics)
		.map((item) => {
			const trackScore = lyricsKey(item.trackName) === wantedTrack ? 4 : 0;
			const artistScore = lyricsKey(item.artistName).includes(wantedArtist)
				? 2
				: 0;
			const durationScore =
				durationSeconds && item.duration
					? Math.max(0, 2 - Math.abs(item.duration - durationSeconds) / 8)
					: 0;
			return { item, score: trackScore + artistScore + durationScore };
		})
		.sort((left, right) => right.score - left.score);

	return scored[0]?.item ?? null;
}

function parseLrcTimestamp(value: string): number | null {
	const match = value.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
	if (!match) {
		return null;
	}

	const minutes = Number(match[1]);
	const seconds = Number(match[2]);
	const fraction = match[3] ?? '0';
	const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3));
	if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
		return null;
	}

	return minutes * 60_000 + seconds * 1000 + milliseconds;
}

function parseSyncedLyrics(value?: string | null) {
	if (!value) {
		return [];
	}

	const lines: Array<{ timeMs: number; text: string }> = [];
	for (const rawLine of value.split(/\r?\n/)) {
		const timestamps = [...rawLine.matchAll(/\[([^\]]+)\]/g)];
		const text = rawLine.replace(/\[[^\]]+\]/g, '').trim();
		if (!timestamps.length || !text) {
			continue;
		}

		for (const timestamp of timestamps) {
			const timeMs = parseLrcTimestamp(timestamp[1] ?? '');
			if (timeMs !== null) {
				lines.push({ timeMs, text });
			}
		}
	}

	return lines.sort((left, right) => left.timeMs - right.timeMs);
}

function parsePlainLyrics(value?: string | null) {
	return (value ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((text) => ({ timeMs: null, text }));
}

async function fetchLrclibLyrics(
	track: RainlinkTrack,
): Promise<LrclibLyrics | null> {
	const trackName = cleanLyricsTrackName(track.title ?? '');
	const artistName = cleanLyricsArtistName(String(track.author ?? ''));
	if (!trackName || !artistName) {
		return null;
	}
	const durationSeconds =
		!track.isStream && track.duration > 0
			? Math.round(track.duration / 1000)
			: null;

	const headers = {
		Accept: 'application/json',
		'User-Agent': 'Priyx Dashboard (https://priyx.local)',
	};
	const direct = new URL('https://lrclib.net/api/get');
	direct.searchParams.set('track_name', trackName);
	direct.searchParams.set('artist_name', artistName);
	if (durationSeconds) {
		direct.searchParams.set('duration', String(durationSeconds));
	}

	const directResponse = await fetch(direct, { headers }).catch(() => null);
	if (directResponse?.ok) {
		return (await directResponse.json()) as LrclibLyrics;
	}

	const search = new URL('https://lrclib.net/api/search');
	search.searchParams.set('track_name', trackName);
	search.searchParams.set('artist_name', artistName);
	const searchResponse = await fetch(search, { headers }).catch(() => null);
	if (searchResponse?.ok) {
		const results = (await searchResponse.json()) as LrclibLyrics[];
		const best = bestLyricsResult(
			results,
			trackName,
			artistName,
			durationSeconds,
		);
		if (best) {
			return best;
		}
	}

	const broadSearch = new URL('https://lrclib.net/api/search');
	broadSearch.searchParams.set('q', `${artistName} ${trackName}`);
	const broadResponse = await fetch(broadSearch, { headers }).catch(() => null);
	if (!broadResponse?.ok) {
		return null;
	}

	const broadResults = (await broadResponse.json()) as LrclibLyrics[];
	return bestLyricsResult(broadResults, trackName, artistName, durationSeconds);
}

function serializeLoopMode(player: RainlinkPlayer): 'none' | 'track' | 'queue' {
	if (player.loop === RainlinkLoopMode.SONG) {
		return 'track';
	}

	if (player.loop === RainlinkLoopMode.QUEUE) {
		return 'queue';
	}

	return 'none';
}

function songRequestsConfig(
	config: MusicModuleConfig,
): Record<string, ModuleValue> {
	return isRecordValue(config.songRequests) ? config.songRequests : {};
}

function songRequestPanelText(
	config: MusicModuleConfig,
	key: string,
	fallback: string,
): string {
	const value = songRequestsConfig(config)[key];
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function apiTextDisplay(content: string): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(content);
}

function apiSeparator(): SeparatorBuilder {
	return new SeparatorBuilder()
		.setDivider(true)
		.setSpacing(SeparatorSpacingSize.Small);
}

function apiActionRow(
	row: ActionRowBuilder<ButtonBuilder>,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return row as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>;
}

function apiMusicButton(
	customId: string,
	label: string,
	style = ButtonStyle.Secondary,
): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(style)
		.setDisabled(true);
}

function apiSongRequestPanel(config: MusicModuleConfig): ContainerBuilder {
	const buttonConfig = isRecordValue(songRequestsConfig(config).buttons)
		? (songRequestsConfig(config).buttons as Record<string, ModuleValue>)
		: {};
	const enabled = (key: string) => buttonConfig[key] !== false;
	const definitions = [
		['previous', 'music:player:previous', 'Previous'],
		['rewind', 'music:player:rewind', 'Rewind'],
		['pause', 'music:player:pause', 'Pause'],
		['forward', 'music:player:forward', 'Forward'],
		['skip', 'music:player:skip', 'Skip'],
		['volumeDown', 'music:player:volumeDown', 'Volume-'],
		['loop', 'music:player:loop', 'Loop: Off'],
		['stop', 'music:player:stop', 'Stop', ButtonStyle.Danger],
		['shuffle', 'music:player:shuffle', 'Shuffle'],
		['volumeUp', 'music:player:volumeUp', 'Volume+'],
	] as const;
	const container = new ContainerBuilder()
		.setAccentColor(0x1db954)
		.addTextDisplayComponents(
			apiTextDisplay(
				`## ${songRequestPanelText(config, 'idleTitle', 'Music Player')}`,
			),
		)
		.addSeparatorComponents(apiSeparator())
		.addTextDisplayComponents(
			apiTextDisplay(
				songRequestPanelText(
					config,
					'idleDescription',
					'No music is currently playing. Join a voice channel and send a song name or link to start playing.',
				),
			),
		)
		.addTextDisplayComponents(
			apiTextDisplay(
				`> ${songRequestPanelText(
					config,
					'requestPlaceholder',
					'Type a song name or link in this channel.',
				)}`,
			),
		);

	const buttons = definitions.filter(([key]) => enabled(key));
	for (let index = 0; index < buttons.length; index += 5) {
		container.addActionRowComponents(
			apiActionRow(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					buttons
						.slice(index, index + 5)
						.map(([, customId, label, style]) =>
							apiMusicButton(customId, label, style ?? ButtonStyle.Secondary),
						),
				),
			),
		);
	}

	return container
		.addSeparatorComponents(apiSeparator())
		.addTextDisplayComponents(apiTextDisplay('Priyx song requests'));
}

async function postSongRequestPanelSafe(
	client: PriyxClient,
	guildId: string,
	channelId: string,
	config: MusicModuleConfig,
	forceSend = false,
): Promise<void> {
	const helper = postSongRequestPanel as unknown;
	if (typeof helper === 'function') {
		await (helper as typeof postSongRequestPanel)(
			client,
			guildId,
			channelId,
			config,
			forceSend,
		);
		return;
	}

	const channel =
		client.channels.cache.get(channelId) ??
		(await client.channels.fetch(channelId).catch(() => null));
	if (!channel || !('send' in channel) || typeof channel.send !== 'function') {
		return;
	}

	await channel.send({
		components: [apiSongRequestPanel(config)],
		flags: MessageFlags.IsComponentsV2 as const,
	});
}

function firstMusicTextChannel(
	guild: Guild,
	config: MusicModuleConfig,
): GuildTextBasedChannel | null {
	const configuredIds = [
		config.announceChannel,
		String(songRequestsConfig(config).channel ?? ''),
	].filter((channelId): channelId is string => Boolean(channelId));

	for (const channelId of configuredIds) {
		const channel = guild.channels.cache.get(channelId);
		if (channel?.isTextBased() && !channel.isDMBased()) {
			return channel;
		}
	}

	return (
		guild.channels.cache.find((channel): channel is GuildTextBasedChannel =>
			Boolean(channel?.isTextBased() && !channel.isDMBased()),
		) ?? null
	);
}

function normalizeDashboardSearchEngine(value?: unknown): string {
	const engine = String(value ?? 'youtube')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');

	if (
		engine === 'youtube_music' ||
		engine === 'youtubemusic' ||
		engine === 'ytm'
	) {
		return 'youtubeMusic';
	}

	if (engine === 'soundcloud' || engine === 'sound_cloud' || engine === 'sc') {
		return 'soundcloud';
	}

	return 'youtube';
}

function dashboardSearchEngines(value?: unknown): string[] {
	const preferred = normalizeDashboardSearchEngine(value);
	return [preferred, 'youtube', 'youtubeMusic', 'soundcloud'].filter(
		(engine, index, engines) => engines.indexOf(engine) === index,
	);
}

async function searchDashboardMusicTracks(
	client: PriyxClient,
	query: string,
	config: MusicModuleConfig,
	requester: unknown,
) {
	if (!client.rainlink) {
		throw new Error('Rainlink is not configured.');
	}

	let lastResult: Awaited<
		ReturnType<NonNullable<PriyxClient['rainlink']>['search']>
	> | null = null;
	let lastError: unknown = null;
	for (const engine of dashboardSearchEngines(config.searchEngine)) {
		const result = await client.rainlink
			.search(query, { requester, engine })
			.catch((error) => {
				lastError = error;
				return null;
			});
		if (result?.tracks.length) {
			return result;
		}
		if (result) {
			lastResult = result;
		}
	}

	if (lastResult) {
		return lastResult;
	}

	throw lastError instanceof Error
		? lastError
		: new Error('Music search failed. Check the Lavalink node.');
}

function musicPlayerPayload(client: PriyxClient, guildId: string) {
	const state = getMusicState(guildId);
	const player = getMusicPlayer(client, guildId);
	return {
		connected: Boolean(client.rainlink),
		active: Boolean(player),
		autoplay: state.autoplay,
		filter: state.filter,
		suggestions: state.suggestions
			.slice(0, 24)
			.map((track, index) => serializeMusicTrack(track, index)),
		player: player
			? {
					voiceId: player.voiceId,
					textId: player.textId,
					playing: Boolean(player.playing),
					paused: Boolean(player.paused),
					volume: player.volume,
					position: player.position,
					loop: serializeLoopMode(player),
					current: serializeMusicTrack(player.queue.current),
					queue: [...player.queue].map((track, index) =>
						serializeMusicTrack(track, index + 1),
					),
					previous: player.queue.previous
						.slice(-10)
						.map((track, index) => serializeMusicTrack(track, index + 1)),
				}
			: null,
	};
}

function inactiveMusicPlayerPayload(client: PriyxClient, guildId: string) {
	const state = getMusicState(guildId);
	return {
		connected: Boolean(client.rainlink),
		active: false,
		autoplay: state.autoplay,
		filter: state.filter,
		suggestions: [],
		player: null,
	};
}

async function ensureMusicRecommendations(
	client: PriyxClient,
	guildId: string,
	config: MusicModuleConfig,
): Promise<void> {
	if (config.ui?.showSuggestions === false) {
		return;
	}

	const player = getMusicPlayer(client, guildId);
	const current = player?.queue.current;
	const state = getMusicState(guildId);
	if (!player || !current) {
		return;
	}

	const currentKey = current.identifier ?? current.uri ?? current.title;
	const stateKey =
		state.lastTrack?.identifier ??
		state.lastTrack?.uri ??
		state.lastTrack?.title;
	if (state.suggestions.length > 0 && stateKey === currentKey) {
		return;
	}

	state.suggestions = await fetchRecommendations(
		client,
		player,
		current,
		Number(config.ui?.suggestionLimit ?? 5),
	).catch(() => []);
}

async function sendMusicPlayer(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	setupRainlink(ctx.client);
	const config = await ctx.client.guildModule(guildId, 'music');
	void ensureMusicRecommendations(ctx.client, guildId, config);
	sendJson(res, 200, musicPlayerPayload(ctx.client, guildId));
}

async function sendMusicSearch(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const query = ctx.url.searchParams.get('q')?.trim() ?? '';
	if (!query) {
		sendJson(res, 400, { error: 'Search query is required.' });
		return;
	}

	setupRainlink(ctx.client);
	if (!ctx.client.rainlink) {
		sendJson(res, 409, { error: 'Rainlink is not configured.' });
		return;
	}

	const config = await ctx.client.guildModule(guildId, 'music');
	const requester = {
		id: access.session.user.id,
		username: access.session.user.username,
	};
	const result = await searchDashboardMusicTracks(
		ctx.client,
		query,
		config,
		requester,
	).catch(() => null);
	if (!result) {
		sendJson(res, 502, {
			error: 'Music search failed. Check the Lavalink node.',
		});
		return;
	}
	sendJson(res, 200, {
		type: result.type,
		playlistName: result.playlistName ?? null,
		tracks: result.tracks
			.slice(0, 25)
			.map((track, index) => serializeMusicTrack(track, index + 1)),
	});
}

async function sendMusicLyrics(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const config = await ctx.client.guildModule(guildId, 'music');
	const lyricsConfig = isRecordValue(config.lyrics) ? config.lyrics : {};
	if (lyricsConfig.enabled === false) {
		sendJson(res, 200, {
			status: 'disabled',
			provider: lyricsConfig.provider ?? 'lrclib',
			track: null,
			lines: [],
			synced: false,
			message: 'Lyrics are disabled for this server.',
		});
		return;
	}

	const player = getMusicPlayer(ctx.client, guildId);
	const current = player?.queue.current;
	if (!player || !current) {
		sendJson(res, 200, {
			status: 'no-track',
			provider: lyricsConfig.provider ?? 'lrclib',
			track: null,
			lines: [],
			synced: false,
			message: 'No track is playing.',
		});
		return;
	}

	const provider = 'lrclib';
	const lyrics = await fetchLrclibLyrics(current).catch(() => null);
	const syncedLines = parseSyncedLyrics(lyrics?.syncedLyrics);
	const plainLines =
		syncedLines.length > 0 ? [] : parsePlainLyrics(lyrics?.plainLyrics);
	const lines = syncedLines.length > 0 ? syncedLines : plainLines;
	sendJson(res, 200, {
		status: lines.length > 0 ? 'found' : 'not-found',
		provider,
		track: serializeMusicTrack(current),
		position: player.position,
		lines,
		synced: syncedLines.length > 0,
		message: lines.length > 0 ? null : 'No lyrics were found for this track.',
	});
}

async function patchMusicPlayer(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const body = await readJson(req);
	if (!isConfigRecord(body)) {
		sendJson(res, 400, { error: 'Request body must be a JSON object.' });
		return;
	}

	const action = String(body.action ?? '').trim();
	const config = await ctx.client.guildModule(guildId, 'music');
	setupRainlink(ctx.client);
	if (!ctx.client.rainlink) {
		sendJson(res, 409, { error: 'Rainlink is not configured.' });
		return;
	}

	if (action === 'play' || action === 'add') {
		const query = String(body.query ?? '').trim();
		if (!query) {
			sendJson(res, 400, { error: 'A track query is required.' });
			return;
		}

		const member = await access.guild.members
			.fetch(access.session.user.id)
			.catch(() => null);
		if (!member?.voice.channel) {
			sendJson(res, 409, {
				error: 'Join a voice channel before starting dashboard playback.',
			});
			return;
		}

		if (
			!isMusicIdAllowed(config.allowedVoiceChannels, member.voice.channelId)
		) {
			sendJson(res, 403, {
				error:
					'Music playback is limited to selected voice channels in this server.',
			});
			return;
		}

		const textChannel = firstMusicTextChannel(access.guild, config);
		if (!textChannel) {
			sendJson(res, 409, {
				error: 'No text channel is available for music updates.',
			});
			return;
		}

		const player = await createOrGetMusicPlayer(
			ctx.client,
			access.guild,
			textChannel.id,
			member.voice.channel,
			config,
		).catch((error) => {
			sendJson(res, 409, {
				error:
					error instanceof Error
						? error.message
						: 'Could not create the music player.',
			});
			return null;
		});
		if (!player) {
			return;
		}
		const requester = {
			id: access.session.user.id,
			username: access.session.user.username,
		};
		const result = await searchDashboardMusicTracks(
			ctx.client,
			query,
			config,
			requester,
		).catch(() => null);
		if (!result) {
			destroyEmptyDashboardPlayer(
				ctx.client,
				player,
				'Dashboard music search cleanup',
			);
			sendJson(res, 502, {
				error: 'Music search failed. Check the Lavalink node.',
			});
			return;
		}
		if (result.tracks.length === 0) {
			destroyEmptyDashboardPlayer(
				ctx.client,
				player,
				'Dashboard empty search cleanup',
			);
			sendJson(res, 404, { error: 'No playable tracks were found.' });
			return;
		}

		const maxQueueSize = Number(config.maxQueueSize ?? 500);
		const availableSlots = Math.max(0, maxQueueSize - player.queue.totalSize);
		if (availableSlots <= 0) {
			destroyEmptyDashboardPlayer(
				ctx.client,
				player,
				'Dashboard full queue cleanup',
			);
			sendJson(res, 409, {
				error: `This server queue is limited to ${maxQueueSize} tracks.`,
			});
			return;
		}

		const tracks =
			result.type === 'PLAYLIST'
				? result.tracks.slice(0, availableSlots)
				: result.tracks.slice(0, 1);
		player.queue.add(tracks);
		if (config.autoShuffle && player.queue.size > 1) {
			player.queue.shuffle();
		}
		const playbackTask = ensureMusicPlayback(player);
		runBackgroundMusicTask(
			ctx.client,
			'Dashboard music playback start',
			playbackTask.then(async () => {
				await updateLivePlayer(ctx.client, player).catch(() => undefined);
				await ensureMusicRecommendations(ctx.client, guildId, config);
			}),
		);
		const payload = musicPlayerPayload(ctx.client, guildId);
		if (payload.player) {
			payload.player.playing = true;
			payload.player.paused = false;
		}
		sendJson(res, 200, payload);
		return;
	}

	const player = getMusicPlayer(ctx.client, guildId);
	if (!player) {
		sendJson(res, 409, {
			error: 'No active music player exists in this server.',
		});
		return;
	}

	let refreshLivePlayer = true;
	let refreshRecommendations = true;
	if (action === 'pause') {
		const paused =
			typeof body.paused === 'boolean' ? body.paused : !player.paused;
		runBackgroundMusicTask(
			ctx.client,
			'Dashboard music pause',
			player.setPause(paused),
		);
		player.paused = paused;
		player.playing = !paused;
	} else if (action === 'previous') {
		refreshLivePlayer = false;
		refreshRecommendations = false;
		runBackgroundMusicTask(
			ctx.client,
			'Dashboard music previous',
			player.previous(),
		);
	} else if (action === 'rewind' || action === 'forward') {
		const current = player.queue.current;
		if (current && !current.isStream) {
			const delta = action === 'rewind' ? -10_000 : 10_000;
			const position = Math.min(
				current.duration,
				Math.max(0, player.position + delta),
			);
			runBackgroundMusicTask(
				ctx.client,
				`Dashboard music ${action}`,
				player.seek(position),
			);
			player.position = position;
		}
	} else if (action === 'skip') {
		refreshLivePlayer = false;
		refreshRecommendations = false;
		runBackgroundMusicTask(ctx.client, 'Dashboard music skip', player.skip());
	} else if (action === 'shuffle') {
		player.queue.shuffle();
	} else if (action === 'loop') {
		if (typeof body.mode === 'string') {
			player.setLoop(loopModeFromConfig(body.mode));
		} else {
			cycleLoop(player);
		}
	} else if (action === 'autoplay') {
		const state = getMusicState(guildId);
		state.autoplay =
			typeof body.enabled === 'boolean' ? body.enabled : !state.autoplay;
	} else if (action === 'volume') {
		const volume = Math.min(
			150,
			Math.max(1, Number(body.volume ?? player.volume)),
		);
		runBackgroundMusicTask(
			ctx.client,
			'Dashboard music volume',
			player.setVolume(volume),
		);
		player.volume = volume;
	} else if (action === 'volumeDown' || action === 'volumeUp') {
		const delta = action === 'volumeDown' ? -10 : 10;
		const volume = Math.min(150, Math.max(1, player.volume + delta));
		runBackgroundMusicTask(
			ctx.client,
			`Dashboard music ${action}`,
			player.setVolume(volume),
		);
		player.volume = volume;
	} else if (action === 'seek') {
		const position = Math.max(0, Number(body.position ?? 0));
		if (player.queue.current && !player.queue.current.isStream) {
			const nextPosition = Math.min(position, player.queue.current.duration);
			runBackgroundMusicTask(
				ctx.client,
				'Dashboard music seek',
				player.seek(nextPosition),
			);
			player.position = nextPosition;
		}
	} else if (action === 'stop') {
		const current = player.queue.current;
		const state = getMusicState(guildId);
		state.suggestions = [];
		state.lastTrack = null;
		player.setLoop(RainlinkLoopMode.NONE);
		player.queue.clear();
		ctx.client.rainlink?.players.delete(guildId);
		runBackgroundMusicTask(
			ctx.client,
			'Dashboard music stop',
			(async () => {
				await endLivePlayer(ctx.client, player, current).catch(() => undefined);
				await player.destroy();
			})(),
		);
		sendJson(res, 200, inactiveMusicPlayerPayload(ctx.client, guildId));
		return;
	} else {
		sendJson(res, 400, { error: 'Unknown music player action.' });
		return;
	}

	if (refreshLivePlayer) {
		void updateLivePlayer(ctx.client, player).catch(() => undefined);
	}
	if (refreshRecommendations) {
		void ensureMusicRecommendations(ctx.client, guildId, config);
	}
	sendJson(res, 200, musicPlayerPayload(ctx.client, guildId));
}

async function createSongRequestChannel(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const body = await readJson(req).catch(() => ({}));
	const requestedName = isConfigRecord(body)
		? String(body.channelName ?? '').trim()
		: '';
	const channelName = (requestedName || 'song-requests')
		.toLowerCase()
		.replace(/[^a-z0-9-_]/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80);
	const channel = await access.guild.channels.create({
		name: channelName || 'song-requests',
		type: ChannelType.GuildText,
		reason: 'Priyx music song request channel',
	});
	const config = await ctx.client.guildModule(guildId, 'music');
	const nextSongRequests: Record<string, ModuleValue> = {
		...songRequestsConfig(config),
		enabled: true,
		channel: channel.id,
		channelName: channel.name,
	};
	await ctx.client.updateGuildModuleConfig(guildId, 'music', {
		songRequests: nextSongRequests,
	});
	const updated = await ctx.client.guildModule(guildId, 'music');
	let panelPosted = false;
	try {
		await postSongRequestPanelSafe(
			ctx.client,
			guildId,
			channel.id,
			updated,
			true,
		);
		panelPosted = true;
	} catch (error) {
		ctx.client
			.addonLogger('api')
			.warn('Failed to post song request panel:', error);
	}
	sendJson(res, 200, {
		channel: { id: channel.id, name: channel.name },
		config: updated,
		panelPosted,
	});
}

async function sendAuditLogs(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
	guildId: string,
): Promise<void> {
	const access = await requireGuild(req, res, ctx, guildId);
	if (!access) {
		return;
	}

	const logs = await access.guild
		.fetchAuditLogs({ limit: 20 })
		.then((audit) =>
			[...audit.entries.values()].map((entry) => ({
				id: entry.id,
				action: entry.action,
				targetId:
					typeof entry.target === 'object' &&
					entry.target !== null &&
					'id' in entry.target
						? String(entry.target.id)
						: null,
				executorId: entry.executorId,
				reason: entry.reason,
				createdAt: entry.createdAt.toISOString(),
			})),
		)
		.catch(() => []);

	sendJson(res, 200, { logs });
}

async function databaseStatus(client: PriyxClient) {
	const started = Date.now();
	try {
		await client.sequelize.authenticate();
		return {
			ok: true,
			dialect: client.sequelize.getDialect(),
			latencyMs: Date.now() - started,
		};
	} catch (error) {
		return {
			ok: false,
			dialect: client.sequelize.getDialect(),
			latencyMs: Date.now() - started,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function redisStatus(client: PriyxClient) {
	const started = Date.now();
	try {
		const key = `api:admin:ping:${Date.now()}`;
		await client.cache.set(key, true, 5);
		const ok = await client.cache.has(key);
		await client.cache.delete(key);
		return {
			ok,
			kind: client.cache.kind,
			latencyMs: Date.now() - started,
		};
	} catch (error) {
		return {
			ok: false,
			kind: client.cache.kind,
			latencyMs: Date.now() - started,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function lavalinkStatus(client: PriyxClient) {
	if (!client.rainlink) {
		return {
			configured: false,
			nodes: [],
			players: 0,
		};
	}

	const nodes = client.rainlink.nodes.full.map(([, node]) => {
		const stats = node.stats;
		return {
			name: node.options.name,
			host: node.options.host,
			port: node.options.port,
			secure: Boolean(node.options.secure),
			online: Boolean(node.online),
			players: stats?.players ?? 0,
			playingPlayers: stats?.playingPlayers ?? 0,
			uptime: stats?.uptime ?? 0,
			memory: stats?.memory ?? null,
			cpu: stats?.cpu ?? null,
		};
	});

	return {
		configured: true,
		nodes,
		players: client.rainlink.players.values.length,
	};
}

function guildList(client: PriyxClient) {
	return [...client.guilds.cache.values()]
		.map((guild) => ({
			id: guild.id,
			name: guild.name,
			iconUrl: guild.iconURL({ size: 128 }) ?? undefined,
			memberCount: guild.memberCount,
			ownerId: guild.ownerId,
			joinedAt: guild.joinedAt?.toISOString() ?? null,
		}))
		.sort((left, right) => right.memberCount - left.memberCount);
}

async function sendAdminStatus(
	res: ServerResponse,
	ctx: RequestContext,
): Promise<void> {
	const [database, redis] = await Promise.all([
		databaseStatus(ctx.client),
		redisStatus(ctx.client),
	]);

	sendJson(res, 200, {
		bot: {
			id: ctx.client.user?.id,
			name: ctx.client.module('bot').name,
			tag: ctx.client.user?.tag,
			avatarUrl: ctx.client.user?.displayAvatarURL({ size: 128 }),
			version: ctx.client.module('bot').version,
			wsPing: ctx.client.ws.ping,
			uptimeSeconds: Math.floor(process.uptime()),
			nodeVersion: process.version,
			guildCount: ctx.client.guilds.cache.size,
			commandCount: ctx.client.commands.size,
		},
		database,
		redis,
		lavalink: lavalinkStatus(ctx.client),
		guilds: guildList(ctx.client),
		users: uniqueDashboardUsers(),
		sessions: [...sessions.values()].map(serializeSession),
		bannedUserIds: [...bannedUserIds].sort(),
		memory: process.memoryUsage(),
	});
}

function sendAdminUsers(res: ServerResponse): void {
	sendJson(res, 200, {
		users: uniqueDashboardUsers(),
		sessions: [...sessions.values()].map(serializeSession),
		bannedUserIds: [...bannedUserIds].sort(),
	});
}

async function patchAdminUser(
	req: IncomingMessage,
	res: ServerResponse,
	userId: string,
): Promise<void> {
	const body = await readJson(req);
	if (!isConfigRecord(body) || typeof body.banned !== 'boolean') {
		sendJson(res, 400, { error: 'Body must include boolean banned.' });
		return;
	}

	if (body.banned) {
		bannedUserIds.add(userId);
		revokeUserSessions(userId);
	} else {
		bannedUserIds.delete(userId);
	}
	await saveAdminState();
	sendAdminUsers(res);
}

async function route(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RequestContext,
): Promise<void> {
	const path = ctx.url.pathname.replace(/\/+$/, '') || '/';
	const parts = path.split('/').filter(Boolean);

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		res.end();
		return;
	}

	if (!hasApiAccess(req, ctx.config, path)) {
		sendJson(res, 401, { error: 'Invalid or missing Priyx API key.' });
		return;
	}

	if (path === '/api/health') {
		sendJson(res, 200, { ok: true, botReady: Boolean(ctx.client.user) });
		return;
	}

	if (path === '/api/meta') {
		sendJson(res, 200, {
			bot: {
				name: ctx.client.module('bot').name,
				version: ctx.client.module('bot').version,
				avatarUrl: ctx.client.user?.displayAvatarURL({ size: 128 }),
			},
			oauthLoginUrl: `${ctx.config.publicUrl}/api/auth/discord`,
			inviteUrl: inviteUrl(ctx.config),
			apiBaseUrl: `${ctx.config.publicUrl}/api`,
		});
		return;
	}

	if (path === '/api/auth/discord' && req.method === 'GET') {
		await startOAuth(req, res, ctx);
		return;
	}

	if (path === '/api/auth/callback' && req.method === 'GET') {
		await finishOAuth(req, res, ctx);
		return;
	}

	if (path === '/api/auth/me' && req.method === 'GET') {
		sendAuthMe(req, res, ctx);
		return;
	}

	if (
		path === '/api/auth/logout' &&
		(req.method === 'POST' || req.method === 'GET')
	) {
		sendLogout(req, res);
		return;
	}

	if (path === '/api/guilds' && req.method === 'GET') {
		sendAuthMe(req, res, ctx);
		return;
	}

	if (path === '/api/invite' && req.method === 'GET') {
		sendJson(res, 200, {
			url: inviteUrl(
				ctx.config,
				ctx.url.searchParams.get('guild_id') ?? undefined,
			),
		});
		return;
	}

	if (path === '/api/admin/status' && req.method === 'GET') {
		await sendAdminStatus(res, ctx);
		return;
	}

	if (path === '/api/admin/users' && req.method === 'GET') {
		sendAdminUsers(res);
		return;
	}

	if (
		parts[0] === 'api' &&
		parts[1] === 'admin' &&
		parts[2] === 'users' &&
		parts[3] &&
		parts[4] === 'ban' &&
		req.method === 'PATCH'
	) {
		await patchAdminUser(req, res, parts[3]);
		return;
	}

	if (path === '/api/admin/guilds' && req.method === 'GET') {
		sendJson(res, 200, { guilds: guildList(ctx.client) });
		return;
	}

	if (parts[0] === 'api' && parts[1] === 'guilds' && parts[2]) {
		const guildId = parts[2];
		if (parts.length === 3 && req.method === 'GET') {
			await sendGuild(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'music' &&
			parts[4] === 'player' &&
			parts.length === 5 &&
			req.method === 'GET'
		) {
			await sendMusicPlayer(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'music' &&
			parts[4] === 'player' &&
			parts.length === 5 &&
			req.method === 'PATCH'
		) {
			await patchMusicPlayer(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'music' &&
			parts[4] === 'search' &&
			parts.length === 5 &&
			req.method === 'GET'
		) {
			await sendMusicSearch(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'music' &&
			parts[4] === 'lyrics' &&
			parts.length === 5 &&
			req.method === 'GET'
		) {
			await sendMusicLyrics(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'music' &&
			parts[4] === 'song-requests' &&
			parts[5] === 'channel' &&
			parts.length === 6 &&
			req.method === 'POST'
		) {
			await createSongRequestChannel(req, res, ctx, guildId);
			return;
		}

		if (parts[3] === 'modules' && parts.length === 4 && req.method === 'GET') {
			await sendModules(req, res, ctx, guildId);
			return;
		}

		if (
			parts[3] === 'modules' &&
			parts[4] &&
			parts.length === 5 &&
			req.method === 'PATCH'
		) {
			await patchModule(req, res, ctx, guildId, parts[4]);
			return;
		}

		if (parts[3] === 'audit-logs' && req.method === 'GET') {
			await sendAuditLogs(req, res, ctx, guildId);
			return;
		}
	}

	sendJson(res, 404, { error: 'Not found.' });
}

class ApiAddon extends PriyxAddon {
	private server?: Server;

	public constructor() {
		super({
			name: 'api',
			description: 'HTTP API and Discord OAuth bridge for the Priyx dashboard.',
			version: '1.0.0',
			author: 'Priyx',
		});
	}

	public async setup(client: PriyxClient) {
		const config = withDefaults(client.module('api'));
		if (!config.enabled) {
			client.addonLogger('api').info('API addon disabled.');
			return;
		}

		await loadAdminState();

		this.server = http.createServer((req, res) => {
			setCors(req, res, config);
			const host = req.headers.host ?? `${config.host}:${config.port}`;
			const url = new URL(req.url ?? '/', `http://${host}`);
			route(req, res, { client, config, url }).catch((error) => {
				client.addonLogger('api').error('API request failed:', error);
				if (!res.headersSent) {
					sendJson(res, 500, {
						error:
							error instanceof Error ? error.message : 'Internal API error.',
					});
				} else {
					res.end();
				}
			});
		});

		await new Promise<void>((resolve, reject) => {
			this.server!.once('error', reject);
			this.server!.listen(config.port, config.host, () => {
				this.server!.off('error', reject);
				resolve();
			});
		});

		client
			.addonLogger('api')
			.info(`Dashboard API listening at ${config.publicUrl}/api`);
	}
}

export default new ApiAddon();
