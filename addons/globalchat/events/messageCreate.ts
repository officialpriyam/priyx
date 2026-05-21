import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'globalchat',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		await client.cache.set(
			`globalchat:last:${message.guild.id}`,
			{ authorId: message.author.id, channelId: message.channel.id },
			client.module('bot').redis.ttl.default,
		);
	},
});
