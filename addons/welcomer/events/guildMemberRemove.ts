import { Events, type GuildMember, type PartialGuildMember, type TextChannel } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import {
	buildWelcomerMessage,
	channelFromGuild,
	getWelcomerTarget,
	scheduleDelete,
} from '../helpers';

export default new PriyxEvent({
	name: Events.GuildMemberRemove,
	addon: 'welcomer',
	async execute(client, member: GuildMember | PartialGuildMember) {
		const config = await client.guildModule(member.guild.id, 'welcomer');
		const farewell = getWelcomerTarget(config, 'farewell');
		if (!farewell.enabled || !farewell.channel) {
			return;
		}

		const channel = channelFromGuild(member.guild, String(farewell.channel)) as
			| TextChannel
			| undefined;
		if (!channel?.isTextBased()) {
			return;
		}

		const sent = await channel.send(buildWelcomerMessage(member, 'farewell', farewell));
		await scheduleDelete(sent, farewell.deleteAfter);
	},
});
