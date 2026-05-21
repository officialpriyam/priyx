import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'streak',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		await client.cache.set(
			`streak:last:${message.guild.id}:${message.author.id}`,
			Date.now(),
			(await client.guildModule(message.guild.id, 'streak')).graceWindow ?? 86_400,
		);
	},
});
