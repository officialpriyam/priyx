import { MessageFlags } from 'discord.js';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import { primaryEmbed } from '../../../src/utils/embed';
import { AutoReactRule } from '../database/models/AutoReactRule';

const handler: PriyxSelectMenuHandler = {
	customId: 'autoreact:panel',
	addon: 'autoreact',
	async execute(interaction) {
		if (!interaction.guild) {
			await interaction.reply({
				content: 'Autoreact rules are server-scoped.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const filter = interaction.values[0] ?? 'all';
		const rules = await AutoReactRule.findAll({
			where:
				filter === 'enabled'
					? { guildId: interaction.guild.id, enabled: true }
					: filter === 'disabled'
						? { guildId: interaction.guild.id, enabled: false }
						: { guildId: interaction.guild.id },
			order: [['id', 'ASC']],
			limit: 10,
		});

		await interaction.reply({
			embeds: [
				primaryEmbed(
					'Autoreact panel',
					rules.length === 0
						? 'No rules matched this filter.'
						: rules
								.map((rule) => `**#${rule.id}** ${rule.emoji} when \`${rule.trigger}\``)
								.join('\n'),
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default handler;
