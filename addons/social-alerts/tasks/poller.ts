import type { PriyxTask } from '../../../src/types/addon';

const task: PriyxTask = {
	name: 'socialAlertsPoller',
	addon: 'social-alerts',
	schedule: 300_000,
	async execute(client) {
		for (const guild of client.guilds.cache.values()) {
			if (!(await client.isGuildModuleEnabled(guild.id, 'social-alerts'))) {
				continue;
			}

			const config = await client.guildModule(guild.id, 'social-alerts');
			await client.cache.set(
				`social-alerts:last-poll:${guild.id}`,
				{ at: Date.now(), maxTracked: config.maxTracked },
				config.checkInterval ?? 300,
			);
		}
	},
};

export default task;
