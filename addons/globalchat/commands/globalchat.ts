import {
	ChannelType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import {
	errorEmbed,
	primaryEmbed,
	successEmbed,
} from '../../../src/utils/embed';
import { GlobalChatBridge } from '../database/models/GlobalChatBridge';

function channelIdFromData(data: Record<string, unknown>): string {
	return typeof data.channelId === 'string' ? data.channelId : '';
}

async function upsertBridge(
	guildId: string,
	userId: string,
	channelId: string,
): Promise<void> {
	const existing = await GlobalChatBridge.findOne({ where: { guildId } });
	if (existing) {
		existing.userId = userId;
		existing.data = { ...existing.data, channelId };
		await existing.save();
		return;
	}

	await GlobalChatBridge.create({
		guildId,
		userId,
		data: { channelId },
	});
}

export default new PriyxCommand({
	data: new SlashCommandBuilder()
		.setName('globalchat')
		.setDescription('Manage global chat.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setup')
				.setDescription('Set up global chat.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Text channel to bridge into global chat.')
						.addChannelTypes(
							ChannelType.GuildText,
							ChannelType.GuildAnnouncement,
						)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('remove').setDescription('Remove global chat.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('info').setDescription('Show global chat info.'),
		),
	category: 'globalchat',
	addon: 'globalchat',
	permissions: [PermissionFlagsBits.ManageGuild],
	async execute(interaction, client) {
		if (!interaction.guild) {
			await interaction.reply({
				embeds: [
					errorEmbed('Server only', 'Global chat commands are server-scoped.'),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);

		if (subcommand === 'setup') {
			const channel = interaction.options.getChannel('channel', true);
			if (
				channel.type !== ChannelType.GuildText &&
				channel.type !== ChannelType.GuildAnnouncement
			) {
				await interaction.reply({
					embeds: [
						errorEmbed(
							'Invalid channel',
							'Choose a text or announcement channel.',
						),
					],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await client.updateGuildModuleConfig(interaction.guild.id, 'globalchat', {
				channel: channel.id,
			});
			await upsertBridge(interaction.guild.id, interaction.user.id, channel.id);

			await interaction.reply({
				embeds: [
					successEmbed(
						'Global Chat Setup',
						`Global chat is now bridged through <#${channel.id}>.`,
					),
				],
			});
			return;
		}

		if (subcommand === 'remove') {
			await client.updateGuildModuleConfig(interaction.guild.id, 'globalchat', {
				channel: '',
			});
			await GlobalChatBridge.destroy({
				where: { guildId: interaction.guild.id },
			});

			await interaction.reply({
				embeds: [
					successEmbed(
						'Global Chat Removed',
						'This server is no longer bridged.',
					),
				],
			});
			return;
		}

		const config = await client.guildModule(interaction.guild.id, 'globalchat');
		const bridge = await GlobalChatBridge.findOne({
			where: { guildId: interaction.guild.id },
		});
		const configuredChannel =
			(typeof config.channel === 'string' && config.channel) ||
			(bridge ? channelIdFromData(bridge.data) : '');
		const enabled = await client.isGuildModuleEnabled(
			interaction.guild.id,
			'globalchat',
		);

		await interaction.reply({
			embeds: [
				primaryEmbed(
					'Global Chat Info',
					[
						`Status: **${enabled ? 'enabled' : 'disabled'}**`,
						`Channel: ${configuredChannel ? `<#${configuredChannel}>` : '**not configured**'}`,
						`Bridge: **${bridge ? 'connected' : 'missing'}**`,
					].join('\n'),
				),
			],
		});
	},
});
