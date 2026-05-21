import { Events, type Invite } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.InviteDelete,
	addon: 'invite',
	async execute(client, invite: Invite) {
		if (invite.guild) {
			await client.cache.delete(`invite:${invite.guild.id}:${invite.code}`);
		}
	},
});
