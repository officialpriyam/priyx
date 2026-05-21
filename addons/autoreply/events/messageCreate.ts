import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'autoreply',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		const config = await client.guildModule(message.guild.id, 'autoreply');
		await client.cache.set(
			`autoreply:last:${message.guild.id}`,
			{ matchType: config.matchType, content: message.content.slice(0, 100) },
			client.module('bot').redis.ttl.default,
		);
	},
});
