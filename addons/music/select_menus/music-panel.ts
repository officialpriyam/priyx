import { MessageFlags } from 'discord.js';
import type { RainlinkFilterMode } from 'rainlink';
import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
	addSuggestionToQueue,
	applyMusicFilter,
	buildSimpleMusicContainer,
	formatTrack,
	getMusicPlayer,
	getMusicState,
	hasControlPermission,
	musicFilters,
	replyMusic,
	requireSameVoice,
	updateLivePlayer,
} from '../helpers';

const moduleName = 'music' as const satisfies ModuleName;

const handler: PriyxSelectMenuHandler = {
	customId: 'music:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		if (!interaction.guild) {
			await replyMusic(
				interaction,
				client,
				'Server only',
				'Music menus only work inside a server.',
			);
			return;
		}

		const action = interaction.customId.split(':')[1];
		const config = await client.guildModule(interaction.guild.id, moduleName);

		if (action === 'panel') {
			const enabled = await client.isGuildModuleEnabled(
				interaction.guild.id,
				moduleName,
			);
			await interaction.reply({
				components: [
					buildSimpleMusicContainer(
						client,
						'Music Setup',
						[
							`Enabled: **${enabled ? 'true' : 'false'}**`,
							`Provider: **${config.provider ?? 'rainlink'}**`,
							`Search engine: **${config.searchEngine ?? 'youtube'}**`,
							`Default volume: **${config.defaultVolume ?? 80}%**`,
							`Max queue size: **${config.maxQueueSize ?? 500}**`,
							`DJ role: **${config.djRole ? `<@&${config.djRole}>` : 'Not set'}**`,
							'Use `/music play` to start the live player. Filters and suggestions are inside the player box.',
						].join('\n'),
					),
				],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			});
			return;
		}

		const player = getMusicPlayer(client, interaction.guild.id);
		if (!player) {
			await replyMusic(
				interaction,
				client,
				'Nothing playing',
				'No active music player exists in this server.',
			);
			return;
		}

		if (!(await requireSameVoice(interaction, player))) {
			return;
		}

		if (!(await hasControlPermission(interaction, player, config))) {
			await replyMusic(
				interaction,
				client,
				'Missing permission',
				'Only the requester, a DJ role, or a server manager can control this player.',
			);
			return;
		}

		if (action === 'filter') {
			const filter = interaction.values[0] as RainlinkFilterMode | 'clear';
			await interaction.deferUpdate();
			await applyMusicFilter(player, filter);
			getMusicState(interaction.guild.id).filter = filter;
			await updateLivePlayer(client, player);
			return;
		}

		if (action === 'suggest') {
			if (interaction.values[0] === 'none') {
				await replyMusic(
					interaction,
					client,
					'No suggestions',
					'Suggestions appear after the current track starts and the Lavalink node returns related tracks.',
				);
				return;
			}

			const index = Number(interaction.values[0]);
			const track = await addSuggestionToQueue(client, player, index);
			await interaction.reply({
				components: [
					buildSimpleMusicContainer(
						client,
						'Suggestion Queued',
						formatTrack(track),
					),
				],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			});
			return;
		}

		await replyMusic(
			interaction,
			client,
			'Unknown music menu',
			'This music menu is no longer active. Use `/music nowplaying` to post a fresh player.',
		);
	},
};

export default handler;
