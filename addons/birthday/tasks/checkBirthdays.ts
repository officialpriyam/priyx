import type { PriyxTask } from '../../../src/types/addon';

const task: PriyxTask = {
	name: 'checkBirthdays',
	addon: 'birthday',
	schedule: 60_000,
	async execute(client) {
		for (const guild of client.guilds.cache.values()) {
			if (!(await client.isGuildModuleEnabled(guild.id, 'birthday'))) {
				continue;
			}

			const config = await client.guildModule(guild.id, 'birthday');
			await client.cache.set(
				`birthday:last-check:${guild.id}`,
				{ at: Date.now(), checkTime: config.checkTime },
				300,
			);
		}
	},
};

export default task;
