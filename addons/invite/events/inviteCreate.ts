import { Events, type Invite } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.InviteCreate,
	addon: 'invite',
	async execute(client, invite: Invite) {
		if (!invite.guild) {
			return;
		}

		await client.cache.set(
			`invite:${invite.guild.id}:${invite.code}`,
			{ uses: invite.uses ?? 0, inviterId: invite.inviter?.id },
			client.module('bot').redis.ttl.userdata,
		);
	},
});
