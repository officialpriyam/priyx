import type { PermissionResolvable } from 'discord.js';
import type { CommandData, CoreContainer } from './types';

export interface BaseCommandOptions<TData> {
	data: TData;
	name: string;
	description: string;
	cooldown?: number;
	permissions?: PermissionResolvable[];
	ownerOnly?: boolean;
	guildOnly?: boolean;
}

export class BaseCommand<
	TData = CommandData,
	TInteraction = unknown,
	TClient = unknown,
> {
	public readonly data: TData;
	public readonly meta: CommandData;
	protected container?: CoreContainer;

	public constructor(options: BaseCommandOptions<TData>) {
		this.data = options.data;
		this.meta = {
			name: options.name,
			description: options.description,
			cooldown: options.cooldown ?? 3,
			permissions: options.permissions ?? [],
			ownerOnly: options.ownerOnly ?? false,
			guildOnly: options.guildOnly ?? true,
		};
	}

	public attach(container: CoreContainer): this {
		this.container = container;
		return this;
	}

	public async execute(
		_interaction: TInteraction,
		_client: TClient,
	): Promise<void> {
		throw new Error(`Execute method not implemented for ${this.meta.name}.`);
	}
}
