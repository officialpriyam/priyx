import {
	type ActionRowBuilder,
	type ButtonInteraction,
	type MessageActionRowComponentBuilder,
	MessageFlags,
	type ModalSubmitInteraction,
	PermissionFlagsBits,
	type StringSelectMenuInteraction,
} from 'discord.js';
import type { PriyxClient } from '../client';
import {
	type ModuleName,
	type ModuleValue,
	moduleNames,
} from '../types/modules';
import {
	buttonRow,
	dangerButton,
	primaryButton,
	selectRow,
	stringSelect,
	successButton,
} from './components';
import {
	buildV2Container,
	componentsV2Flags,
	componentsV2ReplyFlags,
	errorEmbed,
} from './embed';
import { titleCase, truncate } from './string';

type GuildPanelInteraction =
	| ButtonInteraction
	| StringSelectMenuInteraction
	| ModalSubmitInteraction;

function isRecord(value: unknown): value is Record<string, ModuleValue> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatModuleValue(value: ModuleValue): string {
	if (value === null || value === undefined || value === '') {
		return 'not set';
	}

	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}

	if (typeof value === 'number') {
		return String(value);
	}

	if (typeof value === 'string') {
		return truncate(value, 180);
	}

	if (Array.isArray(value)) {
		return value.length === 0 ? 'none' : `${value.length} item(s)`;
	}

	if (isRecord(value)) {
		const count = Object.keys(value).length;
		return count === 0 ? 'not set' : `${count} setting(s)`;
	}

	return 'configured';
}

export function isModuleName(value: string): value is ModuleName {
	return (moduleNames as readonly string[]).includes(value);
}

export function moduleConfigLines(
	config: Record<string, ModuleValue>,
): string[] {
	const entries = Object.entries(config).filter(([key]) => key !== 'enabled');
	const lines = entries
		.slice(0, 12)
		.map(([key, value]) => `**${key}:** ${formatModuleValue(value)}`);

	if (entries.length > lines.length) {
		lines.push(`**More:** ${entries.length - lines.length} setting(s) hidden`);
	}

	return lines;
}

export async function guildModuleDescription(
	client: PriyxClient,
	guildId: string,
	moduleName: ModuleName,
): Promise<string> {
	const config = await client.guildModule(guildId, moduleName);
	const lines = isRecord(config) ? moduleConfigLines(config) : [];

	return [
		`Server: **${guildId}**`,
		`Module: **${moduleName}**`,
		`Enabled: **${await client.isGuildModuleEnabled(guildId, moduleName)}**`,
		...lines,
	].join('\n');
}

export function moduleDefaultDescription(
	client: PriyxClient,
	moduleName: ModuleName,
): string {
	const config = client.module(moduleName);
	const lines = isRecord(config) ? moduleConfigLines(config) : [];

	return [
		'Scope: **global default**',
		`Module: **${moduleName}**`,
		`Enabled: **${isRecord(config) && 'enabled' in config ? Boolean(config.enabled) : true}**`,
		...lines,
	].join('\n');
}

export function modulePanelComponents(moduleName: ModuleName) {
	return [
		selectRow(
			stringSelect(`${moduleName}:panel`, 'Module panel', [
				{
					label: 'Configuration',
					value: 'config',
					description: 'Show server override and effective config',
				},
				{
					label: 'Status',
					value: 'status',
					description: 'Show whether this module is enabled here',
				},
			]),
		),
		buttonRow(
			primaryButton(`${moduleName}:settings:refresh`, 'Refresh'),
			successButton(`${moduleName}:settings:enable`, 'Enable'),
			dangerButton(`${moduleName}:settings:disable`, 'Disable'),
		),
	];
}

function modulePanelRows(
	moduleName: ModuleName,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	return modulePanelComponents(moduleName).map(
		(row) => row as ActionRowBuilder<MessageActionRowComponentBuilder>,
	);
}

export async function guildModulePanelContainer(
	client: PriyxClient,
	guildId: string,
	moduleName: ModuleName,
	title = `${titleCase(moduleName)} Settings`,
) {
	return buildV2Container({
		title,
		description: await guildModuleDescription(client, guildId, moduleName),
		actionRows: modulePanelRows(moduleName),
		footer: `${client.module('bot').name} server module panel`,
	});
}

export async function replyWithGuildModulePanel(
	interaction: GuildPanelInteraction,
	client: PriyxClient,
	moduleName: ModuleName,
	title = `${titleCase(moduleName)} Settings`,
): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({
			embeds: [
				errorEmbed('Server only', 'Module settings are stored per server.'),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const payload = {
		components: [
			await guildModulePanelContainer(
				client,
				interaction.guild.id,
				moduleName,
				title,
			),
		],
		flags: componentsV2Flags,
	};

	if (interaction.deferred || interaction.replied) {
		await interaction.editReply(payload);
		return;
	}

	await interaction.reply({ ...payload, flags: componentsV2ReplyFlags(true) });
}

export async function updateGuildModuleEnabled(
	interaction: ButtonInteraction,
	client: PriyxClient,
	moduleName: ModuleName,
	enabled: boolean,
): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({
			embeds: [
				errorEmbed('Server only', 'Module settings are stored per server.'),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			embeds: [
				errorEmbed(
					'Missing permission',
					'You need Manage Server to change module settings.',
				),
			],
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await client.setGuildModuleEnabled(interaction.guild.id, moduleName, enabled);
	await interaction.reply({
		components: [
			buildV2Container({
				title: enabled ? 'Module Enabled' : 'Module Disabled',
				description: `**${moduleName}** is now ${enabled ? 'enabled' : 'disabled'} in this server.`,
				footer: `${client.module('bot').name} server module panel`,
			}),
		],
		flags: componentsV2ReplyFlags(true),
	});
}

export function parseModuleConfigJson(
	raw: string,
): Record<string, ModuleValue> {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed)) {
		throw new Error('Config JSON must be an object.');
	}

	const { enabled: _enabled, ...config } = parsed;
	return config;
}
