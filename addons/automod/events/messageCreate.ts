import { Events, type Message } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';
import { AutomodHelper } from '../helpers';

export default new PriyxEvent({
	name: Events.MessageCreate,
	addon: 'automod',
	async execute(client, message: Message) {
		if (!message.guild || message.author.bot) {
			return;
		}

		try {
			const config = await client.guildModule(message.guild.id, 'automod');
			await AutomodHelper.inspectMessage(client, message, config);
		} catch (error) {
			client.logger.error('[automod] messageCreate failed:', error);
		}
	},
});
