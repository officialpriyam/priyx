import {
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import { moduleNames, type ModuleName } from '../../../src/types/modules';
import {
	buildV2Container,
	componentsV2ReplyFlags,
} from '../../../src/utils/embed';
import { titleCase } from '../../../src/utils/string';

const addonModuleNames = moduleNames.filter(
	(name) => !['bot', 'colors', 'presence'].includes(name),
) as ModuleName[];

const configurableAddonNames = addonModuleNames.filter(
	(name) => name !== 'core',
) as ModuleName[];

function enabledText(enabled: boolean): string {
	return enabled ? 'enabled' : 'disabled';
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('addons')
		.setDescription('Enable, disable, and inspect server addons.')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('List addons for this server.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('status')
				.setDescription('Show one addon status.')
				.addStringOption((option) =>
					option
						.setName('addon')
						.setDescription('Addon to inspect.')
						.setRequired(true)
						.addChoices(
							...configurableAddonNames.map((name) => ({
								name: titleCase(name),
								value: name,
							})),
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('enable')
				.setDescription('Enable an addon in this server.')
				.addStringOption((option) =>
					option
						.setName('addon')
						.setDescription('Addon to enable.')
						.setRequired(true)
						.addChoices(
							...configurableAddonNames.map((name) => ({
								name: titleCase(name),
								value: name,
							})),
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('disable')
				.setDescription('Disable an addon in this server.')
				.addStringOption((option) =>
					option
						.setName('addon')
						.setDescription('Addon to disable.')
						.setRequired(true)
						.addChoices(
							...configurableAddonNames.map((name) => ({
								name: titleCase(name),
								value: name,
							})),
						),
				),
		),
	category: 'core',
	addon: 'core',
	permissions: [PermissionFlagsBits.ManageGuild],
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Server only',
						description: 'Addon settings are stored per server.',
					}),
				],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);

		if (subcommand === 'list') {
			const lines = await Promise.all(
				configurableAddonNames.map(async (name) => {
					const enabled = await client.isGuildModuleEnabled(
						interaction.guild!.id,
						name,
					);
					const fallback = client.module(name);
					const defaultEnabled =
						typeof fallback === 'object' &&
						fallback !== null &&
						'enabled' in fallback
							? Boolean(fallback.enabled)
							: true;
					return `**${titleCase(name)}:** ${enabledText(enabled)} (default ${enabledText(defaultEnabled)})`;
				}),
			);

			await interaction.reply({
				components: [
					buildV2Container({
						title: 'Server Addons',
						description: lines.join('\n'),
						footer: `${client.module('bot').name} addon manager`,
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		const addon = interaction.options.getString('addon', true) as ModuleName;

		if (subcommand === 'status') {
			const enabled = await client.isGuildModuleEnabled(
				interaction.guild.id,
				addon,
			);
			await interaction.reply({
				components: [
					buildV2Container({
						title: `${titleCase(addon)} Status`,
						description: `This addon is **${enabledText(enabled)}** in this server.`,
						footer: `${client.module('bot').name} addon manager`,
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
			return;
		}

		if (subcommand === 'enable' || subcommand === 'disable') {
			const enabled = subcommand === 'enable';
			await client.setGuildModuleEnabled(interaction.guild.id, addon, enabled);
			await interaction.reply({
				components: [
					buildV2Container({
						title: `${titleCase(addon)} ${enabled ? 'Enabled' : 'Disabled'}`,
						description: `**${addon}** is now **${enabledText(enabled)}** in this server.`,
						footer: `${client.module('bot').name} addon manager`,
					}),
				],
				flags: componentsV2ReplyFlags(true),
			});
		}
	},
});
