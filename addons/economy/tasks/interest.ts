import type { PriyxTask } from '../../../src/types/addon';

const task: PriyxTask = {
	name: 'economyInterest',
	addon: 'economy',
	schedule: 3_600_000,
	async execute(client) {
		for (const guild of client.guilds.cache.values()) {
			if (!(await client.isGuildModuleEnabled(guild.id, 'economy'))) {
				continue;
			}

			const config = await client.guildModule(guild.id, 'economy');
			await client.cache.set(
				`economy:last-interest:${guild.id}`,
				{ at: Date.now(), interest: config.interest },
				client.module('bot').redis.ttl.default,
			);
		}
	},
};

export default task;
