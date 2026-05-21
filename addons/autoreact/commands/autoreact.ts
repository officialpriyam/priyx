import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import { buttonRow, dangerButton } from '../../../src/utils/components';
import { errorEmbed, primaryEmbed, successEmbed } from '../../../src/utils/embed';
import { paginate } from '../../../src/utils/paginator';
import { AutoReactRule, type AutoReactMatchType } from '../database/models/AutoReactRule';

function formatRule(rule: AutoReactRule): string {
	return [
		`ID: **${rule.id}**`,
		`Trigger: \`${rule.trigger}\``,
		`Match: **${rule.matchType}**`,
		`Emoji: ${rule.emoji}`,
		`Chance: **${Math.round(rule.chance * 100)}%**`,
		`Channel: ${rule.channelId ? `<#${rule.channelId}>` : 'all channels'}`,
		`Enabled: **${rule.enabled}**`,
	].join('\n');
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('autoreact')
		.setDescription('Manage automatic reaction rules.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('add')
				.setDescription('Create an automatic reaction rule.')
				.addStringOption((option) =>
					option
						.setName('trigger')
						.setDescription('Text that should trigger the reaction.')
						.setRequired(true)
						.setMaxLength(500),
				)
				.addStringOption((option) =>
					option
						.setName('emoji')
						.setDescription('Emoji to react with.')
						.setRequired(true)
						.setMaxLength(128),
				)
				.addStringOption((option) =>
					option
						.setName('match')
						.setDescription('How message text is matched.')
						.addChoices(
							{ name: 'contains', value: 'contains' },
							{ name: 'exact', value: 'exact' },
							{ name: 'starts with', value: 'startsWith' },
							{ name: 'ends with', value: 'endsWith' },
							{ name: 'regex', value: 'regex' },
						),
				)
				.addNumberOption((option) =>
					option
						.setName('chance')
						.setDescription('Chance from 1 to 100 percent.')
						.setMinValue(1)
						.setMaxValue(100),
				)
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Limit the rule to one text channel.')
						.addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('remove')
				.setDescription('Delete an automatic reaction rule.')
				.addIntegerOption((option) =>
					option
						.setName('id')
						.setDescription('Rule ID from /autoreact list.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('toggle')
				.setDescription('Enable or disable an automatic reaction rule.')
				.addIntegerOption((option) =>
					option
						.setName('id')
						.setDescription('Rule ID from /autoreact list.')
						.setRequired(true),
				)
				.addBooleanOption((option) =>
					option
						.setName('enabled')
						.setDescription('Whether this rule should run.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('List automatic reaction rules.'),
		),
	category: 'autoreact',
	addon: 'autoreact',
	permissions: [PermissionFlagsBits.ManageGuild],
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [errorEmbed('Server only', 'Autoreact rules are server-scoped.')],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);
		const config = await client.guildModule(interaction.guild.id, 'autoreact');

		if (subcommand === 'add') {
			const maxRules = Number(config.maxRules ?? 50);
			const count = await AutoReactRule.count({
				where: { guildId: interaction.guild.id },
			});

			if (count >= maxRules) {
				await interaction.reply({
					embeds: [
						errorEmbed('Rule limit reached', `This server can have up to ${maxRules} autoreact rules.`),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const matchType = (interaction.options.getString('match') ??
				config.matchType ??
				'contains') as AutoReactMatchType;
			const chance = (interaction.options.getNumber('chance') ?? 100) / 100;
			const channel = interaction.options.getChannel('channel');

			if (matchType === 'regex') {
				try {
					new RegExp(interaction.options.getString('trigger', true));
				} catch {
					await interaction.reply({
						embeds: [errorEmbed('Invalid regex', 'The trigger is not a valid regular expression.')],
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
			}

			const rule = await AutoReactRule.create({
				guildId: interaction.guild.id,
				createdBy: interaction.user.id,
				trigger: interaction.options.getString('trigger', true),
				matchType,
				emoji: interaction.options.getString('emoji', true),
				chance,
				enabled: true,
				channelId: channel?.id ?? null,
			});

			await client.cache.delete(`autoreact:rules:${interaction.guild.id}`);
			await interaction.reply({
				embeds: [successEmbed('Autoreact rule created', formatRule(rule))],
			});
			return;
		}

		if (subcommand === 'remove') {
			const id = interaction.options.getInteger('id', true);
			const deleted = await AutoReactRule.destroy({
				where: { id, guildId: interaction.guild.id },
			});

			await client.cache.delete(`autoreact:rules:${interaction.guild.id}`);
			await interaction.reply({
				embeds: [
					deleted > 0
						? successEmbed('Autoreact rule removed', `Deleted rule **${id}**.`)
						: errorEmbed('Rule not found', `No autoreact rule exists with ID **${id}**.`),
				],
				flags: deleted > 0 ? undefined : MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'toggle') {
			const id = interaction.options.getInteger('id', true);
			const enabled = interaction.options.getBoolean('enabled', true);
			const rule = await AutoReactRule.findOne({
				where: { id, guildId: interaction.guild.id },
			});

			if (!rule) {
				await interaction.reply({
					embeds: [errorEmbed('Rule not found', `No autoreact rule exists with ID **${id}**.`)],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			rule.enabled = enabled;
			await rule.save();
			await client.cache.delete(`autoreact:rules:${interaction.guild.id}`);
			await interaction.reply({
				embeds: [successEmbed('Autoreact rule updated', formatRule(rule))],
			});
			return;
		}

		const rules = await AutoReactRule.findAll({
			where: { guildId: interaction.guild.id },
			order: [['id', 'ASC']],
		});

		if (rules.length === 0) {
			await interaction.reply({
				embeds: [primaryEmbed('Autoreact rules', 'This server has no autoreact rules yet.')],
			});
			return;
		}

		const pages = rules.map((rule) =>
			primaryEmbed(`Autoreact rule #${rule.id}`, formatRule(rule)),
		);

		await paginate(interaction, pages);
	},
});
