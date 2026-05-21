import cron from 'node-cron';
import type { PriyxClient } from './client';
import { addonLogger } from './logger';
import type { PriyxTask } from './types/addon';

export function scheduleTask(client: PriyxClient, task: PriyxTask): void {
	const log = addonLogger(task.addon);
	if (typeof task.schedule === 'number') {
		setInterval(() => {
			task.execute(client).catch((error: unknown) => {
				log.error(`Task ${task.name} failed:`, error);
			});
		}, task.schedule);
		return;
	}

	cron.schedule(task.schedule, () => {
		task.execute(client).catch((error: unknown) => {
			log.error(`Task ${task.name} failed:`, error);
		});
	});
}
