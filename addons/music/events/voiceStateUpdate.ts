import { Events, type VoiceState } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import {
	getMusicPlayer,
	removeRequesterTracks,
	updateLivePlayer,
} from '../helpers';

export default new PriyxEvent({
	name: Events.VoiceStateUpdate,
	addon: 'music',
	async execute(client, oldState: VoiceState, newState: VoiceState) {
		const guildId = oldState.guild.id;
		const player = getMusicPlayer(client, guildId);
		if (!player?.voiceId || oldState.channelId !== player.voiceId) {
			return;
		}

		if (newState.channelId === player.voiceId) {
			return;
		}

		const config = await client.guildModule(guildId, 'music');
		if (!config.autoLeaveCleanup) {
			return;
		}

		const removed = removeRequesterTracks(player, oldState.id);
		if (removed > 0) {
			await updateLivePlayer(client, player).catch(() => undefined);
		}
	},
});
