import type { PriyxTask } from '../../../src/types/addon';

const task: PriyxTask = {
	name: 'checkGiveaways',
	addon: 'giveaway',
	schedule: 60_000,
	async execute(client) {
		await client.cache.set('giveaway:last-check', Date.now(), 120);
	},
};

export default task;
