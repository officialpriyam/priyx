export type ModulePrimitive = string | number | boolean | null;
export type ModuleValue =
	| ModulePrimitive
	| undefined
	| ModuleValue[]
	| { [key: string]: ModuleValue };

export interface EnabledModuleConfig {
	enabled: boolean;
	[key: string]: ModuleValue;
}

export interface ButtonConfig {
	[key: string]: ModuleValue;
	label?: string;
	emoji?: string;
	style?: string;
}

export interface BotModuleConfig {
	name: string;
	studio: string;
	developer: string;
	version: string;
	prefix: string;
	sharding: {
		totalShards: number | 'auto';
	};
	database: {
		sync: boolean;
		logging: boolean;
	};
	redis: {
		enabled: boolean;
		host: string;
		port: number;
		db: number;
		keyPrefix: string;
		ttl: {
			default: number;
			cooldown: number;
			leaderboard: number;
			userdata: number;
		};
	};
}

export interface ColorsModuleConfig {
	primary: string;
	success: string;
	warning: string;
	error: string;
	info: string;
	economy: string;
	xp: string;
	music: string;
}

export interface PresenceActivityConfig {
	name: string;
	type: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';
}

export interface PresenceModuleConfig {
	status: 'online' | 'idle' | 'dnd' | 'invisible';
	activities: PresenceActivityConfig[];
}

export interface CoreModuleConfig extends EnabledModuleConfig {
	ownerGuildId: string;
	maintenanceMessage: string;
	logChannel: string;
	errorChannel: string;
	defaultCooldown: number;
}

export interface AutomodModuleConfig extends EnabledModuleConfig {
	spam?: ModuleValue;
	badwords?: ModuleValue;
	zalgo?: ModuleValue;
	duplicates?: ModuleValue;
	mentions?: ModuleValue;
	invites?: ModuleValue;
	links?: ModuleValue;
}

export interface EconomyModuleConfig extends EnabledModuleConfig {
	currency?: ModuleValue;
	daily?: ModuleValue;
	work?: ModuleValue;
	rob?: ModuleValue;
	interest?: ModuleValue;
	gambling?: ModuleValue;
	shop?: ModuleValue;
}

export interface LevelingModuleConfig extends EnabledModuleConfig {
	xpPerMessage?: ModuleValue;
	xpCooldown?: number;
	formula?: string;
	customFormula?: string;
	announceChannel?: string;
	announceMessage?: string;
	stackRoles?: boolean;
	ignoredChannels?: ModuleValue[];
	ignoredRoles?: ModuleValue[];
	doubleXpRoles?: ModuleValue[];
	rankCard?: ModuleValue;
}

export interface WelcomerModuleConfig extends EnabledModuleConfig {
	channel?: string;
	messageType?: 'plain' | 'embed' | 'both';
	message?: string;
	deleteAfter?: number;
	mentionUser?: boolean;
	assignRoles?: ModuleValue[];
	welcome?: ModuleValue;
	embed?: ModuleValue;
	farewell?: ModuleValue;
	dm?: ModuleValue;
	card?: ModuleValue;
}

export interface TicketModuleConfig extends EnabledModuleConfig {
	category?: string;
	logChannel?: string;
	supportRoles?: ModuleValue[];
	transcriptChannel?: string;
	closeOnLeave?: boolean;
	naming?: string;
	maxOpenPerUser?: number;
	panelStyle?: 'button' | 'select';
	panel?: ModuleValue;
	buttons?: {
		open?: ButtonConfig;
		close?: ButtonConfig;
		claim?: ButtonConfig;
	};
	categories?: ModuleValue[];
}

export interface SuggestionModuleConfig extends EnabledModuleConfig {
	channel?: string;
	logChannel?: string;
	approvedRole?: string;
	requireReason?: boolean;
	anonymousVoting?: boolean;
	buttons?: ModuleValue;
	status?: ModuleValue;
}

export interface GiveawayModuleConfig extends EnabledModuleConfig {
	defaultDuration?: number;
	maxWinners?: number;
	embedColor?: string;
	endColor?: string;
	rerollWindow?: number;
	checkInterval?: number;
	button?: ButtonConfig;
}

export interface ReactionRoleModuleConfig extends EnabledModuleConfig {
	maxPerMessage?: number;
	allowMultiple?: boolean;
	uniqueMode?: boolean;
}

export interface TempvoiceModuleConfig extends EnabledModuleConfig {
	createChannel?: string;
	category?: string;
	defaultName?: string;
	defaultLimit?: number;
	cleanupInterval?: number;
	allowedBitrate?: number;
}

export interface VerificationModuleConfig extends EnabledModuleConfig {
	role?: string;
	channel?: string;
	logChannel?: string;
	type?: 'button' | 'captcha' | 'reaction';
	captcha?: ModuleValue;
}

export interface MusicModuleConfig extends EnabledModuleConfig {
	defaultVolume?: number;
	maxQueueSize?: number;
	leaveOnEmpty?: boolean;
	leaveOnEmptyDelay?: number;
	leaveOnFinish?: boolean;
	autoplay?: boolean;
	djRole?: string;
	announceChannel?: string;
	lyrics?: ModuleValue;
	provider?: 'rainlink';
	searchEngine?: string;
	ui?: {
		updateInterval?: number;
		suggestionLimit?: number;
		showFilters?: boolean;
		showSuggestions?: boolean;
		artworkStyle?: 'thumbnail' | 'banner';
	};
	lavalink?: {
		nodes?: {
			name: string;
			host: string;
			port: number;
			auth: string;
			secure?: boolean;
			driver?: string;
			region?: string;
		}[];
	};
}

export interface AiKnowledgeDocument {
	[key: string]: ModuleValue;
	title?: string;
	source?: string;
	enabled?: boolean;
	content?: string;
}

export interface AiModuleConfig extends EnabledModuleConfig {
	model?: string;
	maxTokens?: number;
	systemPrompt?: string;
	supportChannel?: string;
	knowledgeBase?: string;
	knowledgeDocuments?: AiKnowledgeDocument[];
	history?: ModuleValue;
	translate?: ModuleValue;
}

export interface BirthdayModuleConfig extends EnabledModuleConfig {
	checkTime?: string;
	message?: string;
	role?: string;
}

export interface InviteModuleConfig extends EnabledModuleConfig {
	trackFakeInvites?: boolean;
	leaderboardSize?: number;
}

export interface EmbedBuilderModuleConfig extends EnabledModuleConfig {
	maxSavedEmbeds?: number;
	allowV2?: boolean;
	maxJsonLength?: number;
	defaultMode?: 'plain' | 'embed' | 'v2';
	previewChannel?: string;
	allowedMentions?: ModuleValue;
	requireManageMessages?: boolean;
	limits?: ModuleValue;
	defaultMessage?: ModuleValue;
	templates?: ModuleValue[];
}

export interface ImageModuleConfig extends EnabledModuleConfig {
	outputFormat?: string;
	maxFileSize?: number;
}

export interface StreakModuleConfig extends EnabledModuleConfig {
	activityType?: string;
	resetTime?: string;
	graceWindow?: number;
}

export interface SocialAlertsModuleConfig extends EnabledModuleConfig {
	checkInterval?: number;
	maxTracked?: number;
}

export interface ApiModuleConfig extends EnabledModuleConfig {
	host?: string;
	port?: number;
	publicUrl?: string;
	dashboardUrl?: string;
	corsOrigin?: string;
	sessionTtl?: number;
	invitePermissions?: string;
	oauthRedirectUri?: string;
	requireApiKey?: boolean;
}

export interface ModulesConfig {
	bot: BotModuleConfig;
	colors: ColorsModuleConfig;
	presence: PresenceModuleConfig;
	core: CoreModuleConfig;
	api: ApiModuleConfig;
	automod: AutomodModuleConfig;
	economy: EconomyModuleConfig;
	leveling: LevelingModuleConfig;
	welcomer: WelcomerModuleConfig;
	ticket: TicketModuleConfig;
	suggestion: SuggestionModuleConfig;
	giveaway: GiveawayModuleConfig;
	'reaction-role': ReactionRoleModuleConfig;
	tempvoice: TempvoiceModuleConfig;
	verification: VerificationModuleConfig;
	music: MusicModuleConfig;
	adventure: EnabledModuleConfig;
	pet: EnabledModuleConfig;
	fun: EnabledModuleConfig;
	ai: AiModuleConfig;
	globalchat: EnabledModuleConfig;
	birthday: BirthdayModuleConfig;
	invite: InviteModuleConfig;
	autoreact: EnabledModuleConfig;
	autoreply: EnabledModuleConfig;
	'embed-builder': EmbedBuilderModuleConfig;
	image: ImageModuleConfig;
	streak: StreakModuleConfig;
	'social-alerts': SocialAlertsModuleConfig;
}

export type ModuleName = keyof ModulesConfig;

export const moduleNames = [
	'bot',
	'colors',
	'presence',
	'core',
	'api',
	'automod',
	'economy',
	'leveling',
	'welcomer',
	'ticket',
	'suggestion',
	'giveaway',
	'reaction-role',
	'tempvoice',
	'verification',
	'music',
	'adventure',
	'pet',
	'fun',
	'ai',
	'globalchat',
	'birthday',
	'invite',
	'autoreact',
	'autoreply',
	'embed-builder',
	'image',
	'streak',
	'social-alerts',
] as const satisfies readonly ModuleName[];
