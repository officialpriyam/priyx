import { Events, type GuildMember, type TextChannel } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import {
	assignWelcomeRoles,
	buildWelcomerMessage,
	channelFromGuild,
	getWelcomerTarget,
	scheduleDelete,
	welcomeDmConfig,
} from '../helpers';

export default new PriyxEvent({
	name: Events.GuildMemberAdd,
	addon: 'welcomer',
	async execute(client, member: GuildMember) {
		const config = await client.guildModule(member.guild.id, 'welcomer');

		await assignWelcomeRoles(member, config);

		const target = getWelcomerTarget(config, 'welcome');
		if (target.channel) {
			const channel = channelFromGuild(member.guild, target.channel) as
			| TextChannel
			| undefined;
			if (channel?.isTextBased()) {
				const sent = await channel.send(buildWelcomerMessage(member, 'welcome', target));
				await scheduleDelete(sent, target.deleteAfter);
			}
		}

		const dm = welcomeDmConfig(config);
		if (dm) {
			await member.send(buildWelcomerMessage(member, 'dm', dm)).catch(() => undefined);
		}
	},
});
