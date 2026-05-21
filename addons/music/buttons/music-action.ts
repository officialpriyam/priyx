import { MessageFlags } from 'discord.js';
import { RainlinkLoopMode } from 'rainlink';
import type { PriyxButtonHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import { updateGuildModuleEnabled } from '../../../src/utils/guildModulePanel';
import {
	buildQueueContainer,
	cycleLoop,
	endLivePlayer,
	getMusicPlayer,
	getMusicState,
	hasControlPermission,
	replyMusic,
	requireSameVoice,
	updateLivePlayer,
} from '../helpers';

const moduleName = 'music' as const satisfies ModuleName;

const handler: PriyxButtonHandler = {
	customId: 'music:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		const parts = interaction.customId.split(':');
		const scope = parts[1];
		const action = parts[2] ?? parts.at(-1);

		if (scope === 'settings') {
			if (action === 'enable') {
				await updateGuildModuleEnabled(interaction, client, moduleName, true);
				return;
			}

			if (action === 'disable') {
				await updateGuildModuleEnabled(interaction, client, moduleName, false);
				return;
			}

			await replyMusic(
				interaction,
				client,
				'Music Setup',
				'Use `/addons enable addon:music`, then `/music play` to start the live player. Music settings are per server.',
			);
			return;
		}

		if (!interaction.guild) {
			await replyMusic(
				interaction,
				client,
				'Server only',
				'Music controls only work inside a server.',
			);
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

		const config = await client.guildModule(interaction.guild.id, moduleName);
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

		if (action === 'queue') {
			await interaction.reply({
				components: [buildQueueContainer(client, player)],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferUpdate();

		if (action === 'autoplay') {
			const state = getMusicState(interaction.guild.id);
			state.autoplay = !state.autoplay;
			await updateLivePlayer(client, player);
			return;
		}

		if (action === 'previous') {
			await player.previous();
			await updateLivePlayer(client, player).catch(() => undefined);
			return;
		}

		if (action === 'pause') {
			if (player.paused) {
				await player.resume();
			} else {
				await player.pause();
			}
			await updateLivePlayer(client, player).catch(() => undefined);
			return;
		}

		if (action === 'skip') {
			await player.skip();
			return;
		}

		if (action === 'loop') {
			cycleLoop(player);
			await updateLivePlayer(client, player).catch(() => undefined);
			return;
		}

		if (action === 'shuffle') {
			player.queue.shuffle();
			await updateLivePlayer(client, player).catch(() => undefined);
			return;
		}

		if (action === 'stop') {
			player.setLoop(RainlinkLoopMode.NONE);
			player.queue.clear();
			await endLivePlayer(client, player, player.queue.current);
			await player.stop(true);
		}
	},
};

export default handler;
