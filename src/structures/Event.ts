import type { ClientEvents } from 'discord.js';
import type { PriyxClient } from '../client';
import { BaseEvent } from '../core';

export interface EventOptions<K extends keyof ClientEvents> {
	name: K;
	once?: boolean;
	addon?: string;
	execute: (client: PriyxClient, ...args: ClientEvents[K]) => Promise<void>;
}

export class PriyxEvent<
	K extends keyof ClientEvents = keyof ClientEvents,
> extends BaseEvent<string, [PriyxClient, ...ClientEvents[K]]> {
	public readonly execute: EventOptions<K>['execute'];

	public constructor(options: EventOptions<K>) {
		super({
			name: String(options.name),
			once: options.once,
			addon: options.addon,
			execute: async (client, ...args) => options.execute(client, ...args),
		});
		this.execute = options.execute;
	}
}
