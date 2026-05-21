import type { PriyxClient } from '../client';
import type {
	ButtonInteraction,
	ModalSubmitInteraction,
	StringSelectMenuInteraction,
} from 'discord.js';

export interface PriyxTask {
	name: string;
	addon: string;
	schedule: string | number;
	execute: (client: PriyxClient) => Promise<void>;
}

export type ComponentMatchMode = 'exact' | 'prefix';

export interface PriyxComponentHandler<TInteraction> {
	customId: string;
	addon: string;
	match?: ComponentMatchMode;
	execute: (interaction: TInteraction, client: PriyxClient) => Promise<void>;
}

export type PriyxButtonHandler = PriyxComponentHandler<ButtonInteraction>;
export type PriyxSelectMenuHandler =
	PriyxComponentHandler<StringSelectMenuInteraction>;
export type PriyxModalHandler = PriyxComponentHandler<ModalSubmitInteraction>;
