import { Events, type GuildMember } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.GuildMemberAdd,
	addon: 'verification',
	async execute(client, member: GuildMember) {
		const config = await client.guildModule(member.guild.id, 'verification');
		const captcha = config.captcha as
			| { timeout?: number }
			| undefined;
		await client.cache.set(
			`verification:joined:${member.guild.id}:${member.id}`,
			Date.now(),
			captcha?.timeout ?? 120,
		);
	},
});
