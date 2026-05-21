import type {
	ChatInputCommandInteraction,
	PermissionResolvable,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { BaseCommand } from '../core';
import type { PriyxClient } from '../client';

export interface SlashCommandLike {
	name: string;
	description: string;
	toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface CommandOptions {
	data: SlashCommandLike;
	category: string;
	addon: string;
	cooldown?: number;
	ownerOnly?: boolean;
	bypassModuleDisabled?: boolean;
	permissions?: PermissionResolvable[];
	execute: (
		interaction: ChatInputCommandInteraction,
		client: PriyxClient,
	) => Promise<void>;
}

export class PriyxCommand extends BaseCommand<
	SlashCommandLike,
	ChatInputCommandInteraction,
	PriyxClient
> {
	public readonly data: SlashCommandLike;
	public readonly category: string;
	public readonly addon: string;
	public readonly cooldown: number;
	public readonly ownerOnly: boolean;
	public readonly bypassModuleDisabled: boolean;
	public readonly permissions: PermissionResolvable[];
	public readonly execute: CommandOptions['execute'];

	public constructor(options: CommandOptions) {
		super({
			data: options.data,
			name: options.data.name,
			description: options.data.description,
			cooldown: options.cooldown,
			permissions: options.permissions,
			ownerOnly: options.ownerOnly,
		});
		this.data = options.data;
		this.category = options.category;
		this.addon = options.addon;
		this.cooldown = options.cooldown ?? 3;
		this.ownerOnly = options.ownerOnly ?? false;
		this.bypassModuleDisabled = options.bypassModuleDisabled ?? false;
		this.permissions = options.permissions ?? [];
		this.execute = options.execute;
	}
}
