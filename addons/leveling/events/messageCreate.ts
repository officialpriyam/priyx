import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import { randomInt } from '../../../src/utils/random';

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'leveling',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		const config = await client.guildModule(message.guild.id, 'leveling');
		const xpRange = config.xpPerMessage as
			| { min?: number; max?: number }
			| undefined;
		const cooldownKey = `xp:cooldown:${message.guild.id}:${message.author.id}`;
		if (await client.cache.has(cooldownKey)) {
			return;
		}

		const min = Number(xpRange?.min ?? 15);
		const max = Number(xpRange?.max ?? 40);
		const xp = randomInt(min, max);

		await client.cache.set(cooldownKey, true, config.xpCooldown ?? 60);
		await client.cache.set(
			`xp:last:${message.guild.id}:${message.author.id}`,
			{ xp, at: Date.now() },
			client.module('bot').redis.ttl.userdata,
		);
	},
});
