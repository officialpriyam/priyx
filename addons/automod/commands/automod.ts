import {
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { PriyxClient } from '../../../src/client';
import { PriyxCommand } from '../../../src/structures/Command';
import {
	buttonRow,
	dangerButton,
	secondaryButton,
	successButton,
} from '../../../src/utils/components';
import {
	buildV2Container,
	componentsV2ReplyFlags,
} from '../../../src/utils/embed';
import {
	AUTOMOD_FEATURES,
	defaultAutomodFeatures,
	defaultAutomodPunishment,
	defaultAutomodThresholds,
	type AutomodFeature,
	type AutomodSetting,
	type AutomodThresholds,
} from '../database/models/AutomodSetting';
import { AutomodHelper } from '../helpers';

type ListField =
	| 'badWords'
	| 'badwordWhitelist'
	| 'ignoredChannels'
	| 'whitelistUsers'
	| 'whitelistRoles'
	| 'allowedDomains';

interface ThresholdChoice {
	value: string;
	label: string;
	key: keyof AutomodThresholds;
	min: number;
	max: number;
	integer: boolean;
}

const featureLabels: Record<AutomodFeature, string> = {
	antiSpam: 'Anti-Spam',
	antiDuplicate: 'Anti-Duplicate',
	antiBadword: 'Anti-Badwords',
	antiInvites: 'Anti-Invites',
	antiLinks: 'Anti-Links',
	antiMentions: 'Anti-Mentions',
	antiAllCaps: 'Anti-All Caps',
	antiEmojiSpam: 'Anti-Emoji Spam',
	antiZalgo: 'Anti-Zalgo',
};

const thresholdChoices: ThresholdChoice[] = [
	{
		value: 'spam-messages',
		label: 'Spam messages',
		key: 'spamMessages',
		min: 2,
		max: 25,
		integer: true,
	},
	{
		value: 'spam-window',
		label: 'Spam window seconds',
		key: 'spamWindowSeconds',
		min: 5,
		max: 300,
		integer: true,
	},
	{
		value: 'duplicate-messages',
		label: 'Duplicate messages',
		key: 'duplicateMessages',
		min: 2,
		max: 15,
		integer: true,
	},
	{
		value: 'duplicate-window',
		label: 'Duplicate window seconds',
		key: 'duplicateWindowSeconds',
		min: 30,
		max: 3600,
		integer: true,
	},
	{
		value: 'short-messages',
		label: 'Short message spam count',
		key: 'shortMessages',
		min: 2,
		max: 25,
		integer: true,
	},
	{
		value: 'mention-count',
		label: 'Mention count',
		key: 'mentionCount',
		min: 2,
		max: 50,
		integer: true,
	},
	{
		value: 'all-caps-min-length',
		label: 'All-caps minimum length',
		key: 'allCapsMinLength',
		min: 5,
		max: 200,
		integer: true,
	},
	{
		value: 'all-caps-ratio',
		label: 'All-caps ratio',
		key: 'allCapsRatio',
		min: 0.3,
		max: 1,
		integer: false,
	},
	{
		value: 'emoji-min-total',
		label: 'Emoji minimum total',
		key: 'emojiMinTotal',
		min: 3,
		max: 100,
		integer: true,
	},
	{
		value: 'emoji-ratio',
		label: 'Emoji ratio',
		key: 'emojiRatio',
		min: 0.2,
		max: 1,
		integer: false,
	},
	{
		value: 'zalgo-marks',
		label: 'Zalgo combining marks',
		key: 'zalgoMarks',
		min: 3,
		max: 100,
		integer: true,
	},
];

function mentionList(
	values: string[],
	type: 'user' | 'role' | 'channel',
): string {
	if (values.length === 0) {
		return 'None';
	}

	return values
		.map((value) => {
			if (type === 'role') {
				return `<@&${value}>`;
			}
			if (type === 'channel') {
				return `<#${value}>`;
			}
			return `<@${value}>`;
		})
		.join('\n');
}

function codeList(values: string[]): string {
	if (values.length === 0) {
		return 'None';
	}

	return values.map((value) => `\`${value}\``).join('\n');
}

function setList(
	setting: AutomodSetting,
	field: ListField,
	values: string[],
): void {
	switch (field) {
		case 'badWords':
			setting.badWords = values;
			break;
		case 'badwordWhitelist':
			setting.badwordWhitelist = values;
			break;
		case 'ignoredChannels':
			setting.ignoredChannels = values;
			break;
		case 'whitelistUsers':
			setting.whitelistUsers = values;
			break;
		case 'whitelistRoles':
			setting.whitelistRoles = values;
			break;
		case 'allowedDomains':
			setting.allowedDomains = values;
			break;
	}
}

function normalizeListValue(field: ListField, value: string): string {
	if (field === 'allowedDomains') {
		return AutomodHelper.normalizeDomain(value);
	}

	return value.trim().toLowerCase();
}

async function replyV2(
	interaction: ChatInputCommandInteraction,
	title: string,
	description: string,
	options: {
		ephemeral?: boolean;
		sections?: string[];
		actionRows?: Parameters<typeof buildV2Container>[0]['actionRows'];
	} = {},
): Promise<void> {
	await interaction.reply({
		components: [
			buildV2Container({
				title,
				description,
				sections: options.sections,
				actionRows: options.actionRows,
				footer: 'Priyx automod',
			}),
		],
		flags: componentsV2ReplyFlags(options.ephemeral ?? true),
	});
}

async function showStatus(
	interaction: ChatInputCommandInteraction,
	client: PriyxClient,
): Promise<void> {
	if (!interaction.guild) {
		await replyV2(
			interaction,
			'Server only',
			'Automod is configured per server.',
		);
		return;
	}

	const moduleConfig = await client.guildModule(
		interaction.guild.id,
		'automod',
	);
	const setting = await AutomodHelper.getSetting(
		interaction.guild.id,
		moduleConfig,
	);
	const runtime = AutomodHelper.runtimeSettings(setting);
	const moduleEnabled = moduleConfig.enabled !== false;
	const featureLines = AUTOMOD_FEATURES.map(
		(feature) =>
			`${runtime.features[feature] ? 'ON ' : 'OFF'} ${featureLabels[feature]}`,
	).join('\n');
	const thresholdLines = thresholdChoices
		.map((choice) => `${choice.label}: **${runtime.thresholds[choice.key]}**`)
		.join('\n');

	await replyV2(
		interaction,
		'Automod status',
		`Module: **${moduleEnabled ? 'enabled' : 'disabled'}**`,
		{
			sections: [
				`**Features**\n${featureLines}`,
				`**Thresholds**\n${thresholdLines}`,
				[
					`**Badwords:** ${runtime.badWords.length}`,
					`**Badword whitelist:** ${runtime.badwordWhitelist.length}`,
					`**Ignored channels:** ${runtime.ignoredChannels.length}`,
					`**Whitelisted users:** ${runtime.whitelistUsers.length}`,
					`**Whitelisted roles:** ${runtime.whitelistRoles.length}`,
					`**Allowed domains:** ${runtime.allowedDomains.length}`,
					`**Log channel:** ${runtime.logChannelId ? `<#${runtime.logChannelId}>` : 'not set'}`,
				].join('\n'),
			],
			actionRows: [
				buttonRow(
					moduleEnabled
						? dangerButton('automod:disable', 'Disable module')
						: successButton('automod:enable', 'Enable module'),
					secondaryButton('automod:panel', 'Module panel'),
				),
			],
		},
	);
}

async function updateList(
	interaction: ChatInputCommandInteraction,
	field: ListField,
	action: 'add' | 'remove',
	value: string,
	label: string,
): Promise<void> {
	if (!interaction.guild) {
		await replyV2(
			interaction,
			'Server only',
			'Automod is configured per server.',
		);
		return;
	}

	const setting = await AutomodHelper.getSetting(interaction.guild.id);
	const current = AutomodHelper.normalizedList(setting[field], {
		domains: field === 'allowedDomains',
	});
	const normalized = normalizeListValue(field, value);
	const exists = current.includes(normalized);

	if (action === 'add') {
		if (!exists) {
			current.push(normalized);
		}
		setList(setting, field, current);
		setting.changed(field, true);
		await setting.save();
		await replyV2(
			interaction,
			`${label} updated`,
			exists
				? `\`${normalized}\` was already in this list.`
				: `Added \`${normalized}\` to this list.`,
		);
		return;
	}

	if (exists) {
		setList(
			setting,
			field,
			current.filter((item) => item !== normalized),
		);
		setting.changed(field, true);
		await setting.save();
	}

	await replyV2(
		interaction,
		`${label} updated`,
		exists
			? `Removed \`${normalized}\` from this list.`
			: `\`${normalized}\` was not in this list.`,
	);
}

async function listValues(
	interaction: ChatInputCommandInteraction,
	field: ListField,
	title: string,
	type: 'code' | 'user' | 'role' | 'channel',
): Promise<void> {
	if (!interaction.guild) {
		await replyV2(
			interaction,
			'Server only',
			'Automod is configured per server.',
		);
		return;
	}

	const setting = await AutomodHelper.getSetting(interaction.guild.id);
	const values = AutomodHelper.normalizedList(setting[field], {
		domains: field === 'allowedDomains',
	});
	let description = codeList(values);

	if (type !== 'code') {
		description = mentionList(values, type);
	}

	await replyV2(interaction, title, description);
}

async function handleGroupedList(
	interaction: ChatInputCommandInteraction,
	group: string,
	subcommand: string,
): Promise<boolean> {
	if (group === 'badwords') {
		if (subcommand === 'list') {
			await listValues(interaction, 'badWords', 'Blocked words', 'code');
			return true;
		}

		await updateList(
			interaction,
			'badWords',
			subcommand as 'add' | 'remove',
			interaction.options.getString('word', true),
			'Blocked words',
		);
		return true;
	}

	if (group === 'badword-whitelist') {
		if (subcommand === 'list') {
			await listValues(
				interaction,
				'badwordWhitelist',
				'Badword whitelist',
				'code',
			);
			return true;
		}

		await updateList(
			interaction,
			'badwordWhitelist',
			subcommand as 'add' | 'remove',
			interaction.options.getString('word', true),
			'Badword whitelist',
		);
		return true;
	}

	if (group === 'allowed-domains') {
		if (subcommand === 'list') {
			await listValues(
				interaction,
				'allowedDomains',
				'Allowed domains',
				'code',
			);
			return true;
		}

		await updateList(
			interaction,
			'allowedDomains',
			subcommand as 'add' | 'remove',
			interaction.options.getString('domain', true),
			'Allowed domains',
		);
		return true;
	}

	if (group === 'ignored-channels') {
		if (subcommand === 'list') {
			await listValues(
				interaction,
				'ignoredChannels',
				'Ignored channels',
				'channel',
			);
			return true;
		}

		await updateList(
			interaction,
			'ignoredChannels',
			subcommand as 'add' | 'remove',
			interaction.options.getChannel('channel', true).id,
			'Ignored channels',
		);
		return true;
	}

	if (group === 'whitelist') {
		if (subcommand === 'list') {
			if (!interaction.guild) {
				await replyV2(
					interaction,
					'Server only',
					'Automod is configured per server.',
				);
				return true;
			}

			const setting = await AutomodHelper.getSetting(interaction.guild.id);
			const users = AutomodHelper.normalizedList(setting.whitelistUsers);
			const roles = AutomodHelper.normalizedList(setting.whitelistRoles);
			await replyV2(
				interaction,
				'Automod whitelist',
				'Users and roles that bypass automod.',
				{
					sections: [
						`**Users**\n${mentionList(users, 'user')}`,
						`**Roles**\n${mentionList(roles, 'role')}`,
					],
				},
			);
			return true;
		}

		const targetId = String(interaction.options.get('target', true).value);
		const isRole = Boolean(interaction.guild?.roles.cache.has(targetId));
		await updateList(
			interaction,
			isRole ? 'whitelistRoles' : 'whitelistUsers',
			subcommand as 'add' | 'remove',
			targetId,
			isRole ? 'Whitelisted roles' : 'Whitelisted users',
		);
		return true;
	}

	return false;
}

async function handleLogs(
	interaction: ChatInputCommandInteraction,
	subcommand: string,
): Promise<boolean> {
	if (subcommand !== 'set' && subcommand !== 'clear') {
		return false;
	}

	if (!interaction.guild) {
		await replyV2(
			interaction,
			'Server only',
			'Automod is configured per server.',
		);
		return true;
	}

	const setting = await AutomodHelper.getSetting(interaction.guild.id);

	if (subcommand === 'clear') {
		setting.logChannelId = null;
		await setting.save();
		await replyV2(interaction, 'Automod logs', 'Automod log channel cleared.');
		return true;
	}

	const channel = interaction.options.getChannel('channel', true);
	const isTextBased =
		'isTextBased' in channel &&
		typeof channel.isTextBased === 'function' &&
		channel.isTextBased();
	if (!isTextBased) {
		await replyV2(interaction, 'Invalid channel', 'Choose a text channel.');
		return true;
	}

	setting.logChannelId = channel.id;
	await setting.save();
	await replyV2(
		interaction,
		'Automod logs',
		`Automod log channel set to <#${channel.id}>.`,
	);
	return true;
}

async function handleThresholds(
	interaction: ChatInputCommandInteraction,
	subcommand: string,
): Promise<boolean> {
	if (subcommand !== 'set' && subcommand !== 'reset') {
		return false;
	}

	if (!interaction.guild) {
		await replyV2(
			interaction,
			'Server only',
			'Automod is configured per server.',
		);
		return true;
	}

	const setting = await AutomodHelper.getSetting(interaction.guild.id);

	if (subcommand === 'reset') {
		setting.thresholds = defaultAutomodThresholds();
		setting.punishment = defaultAutomodPunishment();
		setting.changed('thresholds', true);
		setting.changed('punishment', true);
		await setting.save();
		await replyV2(
			interaction,
			'Automod thresholds',
			'Thresholds reset to defaults.',
		);
		return true;
	}

	const selected = interaction.options.getString('setting', true);
	const choice = thresholdChoices.find((item) => item.value === selected);
	if (!choice) {
		await replyV2(
			interaction,
			'Invalid threshold',
			'Choose a supported threshold.',
		);
		return true;
	}

	const value = interaction.options.getNumber('value', true);
	if (value < choice.min || value > choice.max) {
		await replyV2(
			interaction,
			'Invalid value',
			`${choice.label} must be between ${choice.min} and ${choice.max}.`,
		);
		return true;
	}

	if (choice.integer && !Number.isInteger(value)) {
		await replyV2(
			interaction,
			'Invalid value',
			`${choice.label} must be a whole number.`,
		);
		return true;
	}

	const runtime = AutomodHelper.runtimeSettings(setting);
	setting.thresholds = {
		...runtime.thresholds,
		[choice.key]: choice.integer ? Math.trunc(value) : Number(value.toFixed(2)),
	};
	setting.changed('thresholds', true);
	await setting.save();

	await replyV2(
		interaction,
		'Automod threshold updated',
		`${choice.label} is now **${setting.thresholds[choice.key]}**.`,
	);
	return true;
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('automod')
		.setDescription('Configure server automod protections.')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('status')
				.setDescription('View automod configuration.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('module')
				.setDescription('Enable or disable the automod module in this server.')
				.addBooleanOption((option) =>
					option
						.setName('enabled')
						.setDescription('Whether automod should run in this server.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('toggle')
				.setDescription('Enable or disable one automod feature.')
				.addStringOption((option) =>
					option
						.setName('feature')
						.setDescription('Feature to update.')
						.setRequired(true)
						.addChoices(
							...AUTOMOD_FEATURES.map((feature) => ({
								name: featureLabels[feature],
								value: feature,
							})),
						),
				)
				.addBooleanOption((option) =>
					option
						.setName('enabled')
						.setDescription('Whether this feature should run.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('reset')
				.setDescription('Reset automod features and thresholds to defaults.'),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('badwords')
				.setDescription('Manage blocked words.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Add a blocked word.')
						.addStringOption((option) =>
							option
								.setName('word')
								.setDescription('Word or phrase to block.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove a blocked word.')
						.addStringOption((option) =>
							option
								.setName('word')
								.setDescription('Word or phrase to remove.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List blocked words.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('badword-whitelist')
				.setDescription('Manage allowed words that bypass badword checks.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Add an allowed word.')
						.addStringOption((option) =>
							option
								.setName('word')
								.setDescription('Word or phrase to allow.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove an allowed word.')
						.addStringOption((option) =>
							option
								.setName('word')
								.setDescription('Word or phrase to remove.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List allowed words.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('whitelist')
				.setDescription('Manage users and roles ignored by automod.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Whitelist a user or role.')
						.addMentionableOption((option) =>
							option
								.setName('target')
								.setDescription('User or role to whitelist.')
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove a user or role from the whitelist.')
						.addMentionableOption((option) =>
							option
								.setName('target')
								.setDescription('User or role to remove.')
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('list')
						.setDescription('List whitelisted users and roles.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('ignored-channels')
				.setDescription('Manage channels ignored by automod.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Ignore a channel.')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to ignore.')
								.addChannelTypes(
									ChannelType.GuildText,
									ChannelType.GuildAnnouncement,
								)
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Stop ignoring a channel.')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to remove.')
								.addChannelTypes(
									ChannelType.GuildText,
									ChannelType.GuildAnnouncement,
								)
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List ignored channels.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('allowed-domains')
				.setDescription('Manage domains allowed when anti-links is enabled.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Allow a domain.')
						.addStringOption((option) =>
							option
								.setName('domain')
								.setDescription('Domain to allow, for example example.com.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove an allowed domain.')
						.addStringOption((option) =>
							option
								.setName('domain')
								.setDescription('Domain to remove.')
								.setRequired(true)
								.setMaxLength(120),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List allowed domains.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('logs')
				.setDescription('Configure automod logs.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('set')
						.setDescription('Set the automod log channel.')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Text channel for automod logs.')
								.addChannelTypes(
									ChannelType.GuildText,
									ChannelType.GuildAnnouncement,
								)
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('clear')
						.setDescription('Clear the automod log channel.'),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('thresholds')
				.setDescription('Tune automod detection thresholds.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('set')
						.setDescription('Set a detection threshold.')
						.addStringOption((option) =>
							option
								.setName('setting')
								.setDescription('Threshold to change.')
								.setRequired(true)
								.addChoices(
									...thresholdChoices.map((choice) => ({
										name: choice.label,
										value: choice.value,
									})),
								),
						)
						.addNumberOption((option) =>
							option
								.setName('value')
								.setDescription('New threshold value.')
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('reset')
						.setDescription('Reset thresholds to defaults.'),
				),
		),
	category: 'automod',
	addon: 'automod',
	bypassModuleDisabled: true,
	permissions: [PermissionFlagsBits.ManageGuild],
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Server only',
						description: 'Automod is configured per server.',
					}),
				],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			});
			return;
		}

		const group = interaction.options.getSubcommandGroup(false);
		const subcommand = interaction.options.getSubcommand(true);

		if (group && (await handleGroupedList(interaction, group, subcommand))) {
			return;
		}

		if (group === 'logs' && (await handleLogs(interaction, subcommand))) {
			return;
		}

		if (
			group === 'thresholds' &&
			(await handleThresholds(interaction, subcommand))
		) {
			return;
		}

		if (subcommand === 'status') {
			await showStatus(interaction, client);
			return;
		}

		if (subcommand === 'module') {
			const enabled = interaction.options.getBoolean('enabled', true);
			await client.setGuildModuleEnabled(
				interaction.guild.id,
				'automod',
				enabled,
			);
			await replyV2(
				interaction,
				'Automod module updated',
				`Automod is now **${enabled ? 'enabled' : 'disabled'}** in this server.`,
			);
			return;
		}

		const setting = await AutomodHelper.getSetting(interaction.guild.id);
		const runtime = AutomodHelper.runtimeSettings(setting);

		if (subcommand === 'toggle') {
			const feature = interaction.options.getString(
				'feature',
				true,
			) as AutomodFeature;
			const enabled = interaction.options.getBoolean('enabled', true);
			setting.features = { ...runtime.features, [feature]: enabled };
			setting.changed('features', true);
			await setting.save();
			await replyV2(
				interaction,
				'Automod feature updated',
				`${featureLabels[feature]} is now **${enabled ? 'enabled' : 'disabled'}**.`,
			);
			return;
		}

		if (subcommand === 'reset') {
			setting.features = defaultAutomodFeatures();
			setting.thresholds = defaultAutomodThresholds();
			setting.punishment = defaultAutomodPunishment();
			setting.changed('features', true);
			setting.changed('thresholds', true);
			setting.changed('punishment', true);
			await setting.save();
			await replyV2(
				interaction,
				'Automod reset',
				'Features, thresholds, and punishment settings were reset to defaults.',
			);
		}
	},
});
