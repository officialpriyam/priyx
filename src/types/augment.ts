import type { Collection } from 'discord.js';
import type { PriyxCommand } from '../structures/Command';

declare module 'discord.js' {
	interface Client {
		priyxCommands?: Collection<string, PriyxCommand>;
	}
}
