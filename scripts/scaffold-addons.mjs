import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const addons = [
	{
		name: 'core',
		description: 'Core utility, moderation, and settings commands.',
		models: [
			{ className: 'Warning', table: 'warnings' },
			{ className: 'GuildSettings', table: 'guild_settings' },
			{ className: 'ModerationLog', table: 'moderation_logs' },
		],
	},
	{ name: 'automod', description: 'Automated moderation rules and logs.', model: 'AutomodCase', table: 'automod_cases' },
	{ name: 'economy', description: 'Coins, wallets, banks, shops, and rewards.', model: 'EconomyAccount', table: 'economy_accounts' },
	{ name: 'leveling', description: 'XP, levels, rank cards, and level roles.', model: 'LevelingProfile', table: 'leveling_profiles' },
	{ name: 'music', description: 'Optional music queue and playback state.', model: 'MusicQueue', table: 'music_queues' },
	{ name: 'adventure', description: 'Adventure profiles, inventory, and combat state.', model: 'AdventureProfile', table: 'adventure_profiles' },
	{ name: 'pet', description: 'Pet ownership, care state, and gacha results.', model: 'PetProfile', table: 'pet_profiles' },
	{ name: 'welcomer', description: 'Welcome, farewell, DM, and card settings.', model: 'WelcomeSetting', table: 'welcome_settings' },
	{ name: 'verification', description: 'Verification panels, roles, and captcha sessions.', model: 'VerificationSession', table: 'verification_sessions' },
	{ name: 'ticket', description: 'Ticket panels, channels, claims, and transcripts.', model: 'Ticket', table: 'tickets' },
	{ name: 'suggestion', description: 'Suggestion submissions, votes, and statuses.', model: 'Suggestion', table: 'suggestions' },
	{ name: 'giveaway', description: 'Giveaway entries, winners, and schedules.', model: 'Giveaway', table: 'giveaways' },
	{ name: 'tempvoice', description: 'Temporary voice configuration and ownership.', model: 'TempVoiceChannel', table: 'temp_voice_channels' },
	{ name: 'reaction-role', description: 'Reaction role panels and role options.', model: 'ReactionRolePanel', table: 'reaction_role_panels' },
	{ name: 'fun', description: 'Trivia, word games, and casual commands.', model: 'FunProfile', table: 'fun_profiles' },
	{ name: 'ai', description: 'AI chat history, user facts, and translation state.', model: 'AiConversation', table: 'ai_conversations' },
	{ name: 'globalchat', description: 'Cross-server chat bridge configuration.', model: 'GlobalChatBridge', table: 'global_chat_bridges' },
	{ name: 'social-alerts', description: 'Social platform alert subscriptions.', model: 'SocialAlertSubscription', table: 'social_alert_subscriptions' },
	{ name: 'birthday', description: 'Birthday dates, roles, and announcements.', model: 'Birthday', table: 'birthdays' },
	{ name: 'invite', description: 'Invite tracking and leaderboard data.', model: 'InviteStat', table: 'invite_stats' },
	{ name: 'autoreact', description: 'Automatic reaction rules.', model: 'AutoReactRule', table: 'auto_react_rules' },
	{ name: 'autoreply', description: 'Automatic reply rules.', model: 'AutoReplyRule', table: 'auto_reply_rules' },
	{ name: 'embed-builder', description: 'Saved embeds and component builder state.', model: 'SavedEmbed', table: 'saved_embeds' },
	{ name: 'image', description: 'Image asset registry and output settings.', model: 'ImageAsset', table: 'image_assets' },
	{ name: 'streak', description: 'Activity streak progress and reset state.', model: 'StreakProfile', table: 'streak_profiles' },
];

function pascal(value) {
	return value
		.split(/[-_\s]+/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

function ensureDir(filePath) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeIfMissing(relativePath, content) {
	const filePath = path.join(root, relativePath);
	if (fs.existsSync(filePath)) {
		return;
	}
	ensureDir(filePath);
	fs.writeFileSync(filePath, content, 'utf8');
}

function writeJsonIfMissing(relativePath, value) {
	writeIfMissing(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function modelTemplate(className, table) {
	return `import { DataTypes, Model, type Sequelize } from 'sequelize';

export class ${className} extends Model {
\tpublic declare id: number;
\tpublic declare guildId: string;
\tpublic declare userId: string | null;
\tpublic declare data: Record<string, unknown>;

\tpublic static initModel(sequelize: Sequelize): typeof ${className} {
\t\t${className}.init(
\t\t\t{
\t\t\t\tid: {
\t\t\t\t\ttype: DataTypes.INTEGER,
\t\t\t\t\tautoIncrement: true,
\t\t\t\t\tprimaryKey: true,
\t\t\t\t},
\t\t\t\tguildId: {
\t\t\t\t\ttype: DataTypes.STRING,
\t\t\t\t\tallowNull: false,
\t\t\t\t},
\t\t\t\tuserId: {
\t\t\t\t\ttype: DataTypes.STRING,
\t\t\t\t\tallowNull: true,
\t\t\t\t},
\t\t\t\tdata: {
\t\t\t\t\ttype: DataTypes.JSON,
\t\t\t\t\tallowNull: false,
\t\t\t\t\tdefaultValue: {},
\t\t\t\t},
\t\t\t},
\t\t\t{ sequelize, tableName: '${table}' },
\t\t);
\t\treturn ${className};
\t}
}
`;
}

function migrationTemplate(table) {
	return `import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
\tasync up(queryInterface, Sequelize) {
\t\tawait queryInterface.createTable('${table}', {
\t\t\tid: {
\t\t\t\ttype: Sequelize.DataTypes.INTEGER,
\t\t\t\tautoIncrement: true,
\t\t\t\tprimaryKey: true,
\t\t\t},
\t\t\tguildId: {
\t\t\t\ttype: Sequelize.DataTypes.STRING,
\t\t\t\tallowNull: false,
\t\t\t},
\t\t\tuserId: {
\t\t\t\ttype: Sequelize.DataTypes.STRING,
\t\t\t\tallowNull: true,
\t\t\t},
\t\t\tdata: {
\t\t\t\ttype: Sequelize.DataTypes.JSON,
\t\t\t\tallowNull: false,
\t\t\t\tdefaultValue: {},
\t\t\t},
\t\t\tcreatedAt: {
\t\t\t\ttype: Sequelize.DataTypes.DATE,
\t\t\t\tallowNull: false,
\t\t\t\tdefaultValue: Sequelize.DataTypes.NOW,
\t\t\t},
\t\t\tupdatedAt: {
\t\t\t\ttype: Sequelize.DataTypes.DATE,
\t\t\t\tallowNull: false,
\t\t\t\tdefaultValue: Sequelize.DataTypes.NOW,
\t\t\t},
\t\t});
\t},
\tasync down(queryInterface) {
\t\tawait queryInterface.dropTable('${table}');
\t},
});
`;
}

function registerTemplate(addon) {
	const className = `${pascal(addon.name)}Addon`;
	return `import { PriyxAddon } from '../../src/structures/Addon';
import type { PriyxClient } from '../../src/client';

class ${className} extends PriyxAddon {
\tpublic constructor() {
\t\tsuper({
\t\t\tname: '${addon.name}',
\t\t\tdescription: '${addon.description}',
\t\t\tversion: '1.0.0',
\t\t\tauthor: 'Priyx',
\t\t});
\t}

\tpublic async setup(client: PriyxClient) {
\t\tawait client.cache.set('addon:${addon.name}:loaded', true, client.module('bot').redis.ttl.default);
\t}
}

export default new ${className}();
`;
}

function buttonTemplate(addonName) {
	return `import type { PriyxButtonHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
\treplyWithGuildModulePanel,
\tupdateGuildModuleEnabled,
} from '../../../src/utils/guildModulePanel';

const moduleName = '${addonName}' as const satisfies ModuleName;

const handler: PriyxButtonHandler = {
\tcustomId: '${addonName}:',
\taddon: moduleName,
\tmatch: 'prefix',
\tasync execute(interaction, client) {
\t\tconst action = interaction.customId.split(':').at(-1);
\t\tif (action === 'enable') {
\t\t\tawait updateGuildModuleEnabled(interaction, client, moduleName, true);
\t\t\treturn;
\t\t}

\t\tif (action === 'disable') {
\t\t\tawait updateGuildModuleEnabled(interaction, client, moduleName, false);
\t\t\treturn;
\t\t}

\t\tawait replyWithGuildModulePanel(interaction, client, moduleName);
\t},
};

export default handler;
`;
}

function selectTemplate(addonName) {
	return `import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import { replyWithGuildModulePanel } from '../../../src/utils/guildModulePanel';
import { titleCase } from '../../../src/utils/string';

const moduleName = '${addonName}' as const satisfies ModuleName;

const handler: PriyxSelectMenuHandler = {
\tcustomId: '${addonName}:panel',
\taddon: moduleName,
\tasync execute(interaction, client) {
\t\tconst view = interaction.values.at(0) ?? 'config';
\t\tawait replyWithGuildModulePanel(
\t\t\tinteraction,
\t\t\tclient,
\t\t\tmoduleName,
\t\t\t\`\${titleCase(moduleName)} \${titleCase(view)}\`,
\t\t);
\t},
};

export default handler;
`;
}

function modalTemplate(addonName) {
	return `import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { PriyxModalHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
\tparseModuleConfigJson,
\treplyWithGuildModulePanel,
} from '../../../src/utils/guildModulePanel';
import { errorEmbed, successEmbed } from '../../../src/utils/embed';

const moduleName = '${addonName}' as const satisfies ModuleName;

const handler: PriyxModalHandler = {
\tcustomId: '${addonName}:modal',
\taddon: moduleName,
\tasync execute(interaction, client) {
\t\tif (!interaction.guild) {
\t\t\tawait interaction.reply({
\t\t\t\tembeds: [errorEmbed('Server only', 'Module settings are stored per server.')],
\t\t\t\tflags: MessageFlags.Ephemeral,
\t\t\t});
\t\t\treturn;
\t\t}

\t\tif (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
\t\t\tawait interaction.reply({
\t\t\t\tembeds: [
\t\t\t\t\terrorEmbed('Missing permission', 'You need Manage Server to change module settings.'),
\t\t\t\t],
\t\t\t\tflags: MessageFlags.Ephemeral,
\t\t\t});
\t\t\treturn;
\t\t}

\t\tlet rawConfig: string;
\t\ttry {
\t\t\trawConfig = interaction.fields.getTextInputValue('configJson');
\t\t} catch {
\t\t\tawait replyWithGuildModulePanel(interaction, client, moduleName);
\t\t\treturn;
\t\t}

\t\ttry {
\t\t\tconst config = parseModuleConfigJson(rawConfig);
\t\t\tawait client.updateGuildModuleConfig(interaction.guild.id, moduleName, config);
\t\t\tawait interaction.reply({
\t\t\t\tembeds: [successEmbed('Module config updated', \`Updated **\${moduleName}** for this server.\`)],
\t\t\t\tflags: MessageFlags.Ephemeral,
\t\t\t});
\t\t} catch (error) {
\t\t\tawait interaction.reply({
\t\t\t\tembeds: [
\t\t\t\t\terrorEmbed(
\t\t\t\t\t\t'Invalid config',
\t\t\t\t\t\terror instanceof Error ? error.message : 'Config JSON could not be parsed.',
\t\t\t\t\t),
\t\t\t\t],
\t\t\t\tflags: MessageFlags.Ephemeral,
\t\t\t});
\t\t}
\t},
};

export default handler;
`;
}
function helperTemplate(addonName) {
	return `export const ${pascal(addonName)}Helper = {
\tmoduleName: '${addonName}',
\tcacheKey(...parts: string[]): string {
\t\treturn ['${addonName}', ...parts].join(':');
\t},
};
`;
}

function seederTemplate(addonName) {
	return `export const ${pascal(addonName)}Seeders = [];
`;
}

function lang(addon) {
	return {
		addon: addon.name,
		name: pascal(addon.name),
		description: addon.description,
		common: {
			enabled: 'Module is enabled.',
			disabled: 'Module is disabled.',
			saved: 'Settings saved.',
			notConfigured: 'This module is not configured yet.',
		},
		commands: {
			panel: {
				title: `${pascal(addon.name)} Panel`,
				description: addon.description,
			},
		},
		components: {
			refresh: 'Refresh',
			confirm: 'Confirm',
			cancel: 'Cancel',
		},
		errors: {
			missingPermission: 'You do not have permission to use this.',
			notInGuild: 'Use this command in a server.',
		},
	};
}

addons.forEach((addon, index) => {
	const addonRoot = `addons/${addon.name}`;
	const modelSpecs = addon.models ?? [{ className: addon.model, table: addon.table }];

	[
		'commands',
		'events',
		'buttons',
		'modals',
		'select_menus',
		'tasks',
		'helpers',
		'lang',
		'database/models',
		'database/migrations',
		'database/seeders',
	].forEach((dir) => {
		fs.mkdirSync(path.join(root, addonRoot, dir), { recursive: true });
	});

	writeJsonIfMissing(`${addonRoot}/addon.json`, {
		name: addon.name,
		description: addon.description,
		version: '1.0.0',
		author: 'Priyx',
		enabled: true,
		priority: addon.name === 'core' ? 0 : 50 + index,
		dependencies: addon.name === 'core' ? [] : ['core'],
	});

	writeIfMissing(`${addonRoot}/register.ts`, registerTemplate(addon));
	writeJsonIfMissing(`${addonRoot}/lang/en-US.json`, lang(addon));
	writeIfMissing(`${addonRoot}/helpers/index.ts`, helperTemplate(addon.name));
	writeIfMissing(`${addonRoot}/database/seeders/index.ts`, seederTemplate(addon.name));
	writeIfMissing(`${addonRoot}/buttons/${addon.name}-action.ts`, buttonTemplate(addon.name));
	writeIfMissing(`${addonRoot}/select_menus/${addon.name}-panel.ts`, selectTemplate(addon.name));
	writeIfMissing(`${addonRoot}/modals/${addon.name}-modal.ts`, modalTemplate(addon.name));

	modelSpecs.forEach((modelSpec, modelIndex) => {
		const migrationNumber = String(index + 1).padStart(3, '0') + String(modelIndex + 1).padStart(2, '0');
		writeIfMissing(
			`${addonRoot}/database/models/${modelSpec.className}.ts`,
			modelTemplate(modelSpec.className, modelSpec.table),
		);
		writeIfMissing(
			`${addonRoot}/database/migrations/20260521_${migrationNumber}_create_${modelSpec.table}.ts`,
			migrationTemplate(modelSpec.table),
		);
	});
});
