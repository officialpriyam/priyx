import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import { AutoReactRule } from '../database/models/AutoReactRule';

function matches(rule: AutoReactRule, content: string): boolean {
	const normalizedContent = content.toLowerCase();
	const normalizedTrigger = rule.trigger.toLowerCase();

	switch (rule.matchType) {
		case 'exact':
			return normalizedContent === normalizedTrigger;
		case 'startsWith':
			return normalizedContent.startsWith(normalizedTrigger);
		case 'endsWith':
			return normalizedContent.endsWith(normalizedTrigger);
		case 'regex':
			try {
				return new RegExp(rule.trigger, 'i').test(content);
			} catch {
				return false;
			}
		case 'contains':
		default:
			return normalizedContent.includes(normalizedTrigger);
	}
}

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'autoreact',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot || !message.content) {
			return;
		}

		const guild = message.guild;
		const cacheKey = `autoreact:rules:${message.guild.id}`;
		const rules = await client.cache.wrap(cacheKey, client.module('bot').redis.ttl.userdata, async () =>
			AutoReactRule.findAll({
				where: { guildId: guild.id, enabled: true },
				order: [['id', 'ASC']],
			}),
		);

		for (const rule of rules) {
			if (rule.channelId && rule.channelId !== message.channel.id) {
				continue;
			}

			if (Math.random() > rule.chance) {
				continue;
			}

			if (!matches(rule, message.content)) {
				continue;
			}

			await message.react(rule.emoji).catch((error: unknown) => {
				client.logger.warn(`Failed to apply autoreact rule ${rule.id}:`, error);
			});
		}
	},
});
