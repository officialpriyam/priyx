import type { PriyxTask } from '../../../src/types/addon';

const task: PriyxTask = {
	name: 'cleanupTempVoice',
	addon: 'tempvoice',
	schedule: 60_000,
	async execute(client) {
		for (const guild of client.guilds.cache.values()) {
			if (!(await client.isGuildModuleEnabled(guild.id, 'tempvoice'))) {
				continue;
			}

			const config = await client.guildModule(guild.id, 'tempvoice');
			await client.cache.set(
				`tempvoice:last-cleanup:${guild.id}`,
				Date.now(),
				config.cleanupInterval ?? 60,
			);
		}
	},
};

export default task;
