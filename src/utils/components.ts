import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextInputBuilder,
	TextInputStyle,
	type APISelectMenuOption,
	type MessageActionRowComponentBuilder,
} from 'discord.js';

export function buttonStyle(style?: string): ButtonStyle {
	switch (style?.toUpperCase()) {
		case 'SECONDARY':
			return ButtonStyle.Secondary;
		case 'SUCCESS':
			return ButtonStyle.Success;
		case 'DANGER':
			return ButtonStyle.Danger;
		case 'LINK':
			return ButtonStyle.Link;
		case 'PRIMARY':
		default:
			return ButtonStyle.Primary;
	}
}

export function buttonRow<T extends MessageActionRowComponentBuilder>(
	...components: T[]
): ActionRowBuilder<T> {
	return new ActionRowBuilder<T>().addComponents(...components);
}

export function primaryButton(
	customId: string,
	label: string,
	emoji?: string,
): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Primary);

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function secondaryButton(
	customId: string,
	label: string,
	emoji?: string,
): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Secondary);

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function successButton(
	customId: string,
	label: string,
	emoji?: string,
): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Success);

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function dangerButton(
	customId: string,
	label: string,
	emoji?: string,
): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Danger);

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function linkButton(label: string, url: string, emoji?: string): ButtonBuilder {
	const button = new ButtonBuilder()
		.setLabel(label)
		.setURL(url)
		.setStyle(ButtonStyle.Link);

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function configuredButton(
	customId: string,
	label: string,
	style?: string,
	emoji?: string,
): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(buttonStyle(style));

	if (emoji) {
		button.setEmoji(emoji);
	}

	return button;
}

export function confirmRow(prefix: string): ActionRowBuilder<ButtonBuilder> {
	return buttonRow(
		successButton(`${prefix}:confirm`, 'Confirm'),
		dangerButton(`${prefix}:cancel`, 'Cancel'),
	);
}

export function paginationRow(
	prefix: string,
	page: number,
	totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
	return buttonRow(
		secondaryButton(`${prefix}:previous`, 'Previous').setDisabled(page <= 0),
		secondaryButton(`${prefix}:stop`, 'Stop'),
		secondaryButton(`${prefix}:next`, 'Next').setDisabled(page >= totalPages - 1),
	);
}

export function stringSelect(
	customId: string,
	placeholder: string,
	options: APISelectMenuOption[],
): StringSelectMenuBuilder {
	return new StringSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder(placeholder)
		.addOptions(
			options.map((option) =>
				new StringSelectMenuOptionBuilder()
					.setLabel(option.label)
					.setValue(option.value)
					.setDescription(option.description ?? 'Select this option'),
			),
		);
}

export function selectRow(
	select: StringSelectMenuBuilder,
): ActionRowBuilder<StringSelectMenuBuilder> {
	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export interface ModalTextInput {
	customId: string;
	label: string;
	style?: TextInputStyle;
	required?: boolean;
	placeholder?: string;
	minLength?: number;
	maxLength?: number;
}

export function buildModal(
	customId: string,
	title: string,
	inputs: ModalTextInput[],
): ModalBuilder {
	const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

	for (const input of inputs) {
		const textInput = new TextInputBuilder()
			.setCustomId(input.customId)
			.setLabel(input.label)
			.setStyle(input.style ?? TextInputStyle.Short)
			.setRequired(input.required ?? true);

		if (input.placeholder) {
			textInput.setPlaceholder(input.placeholder);
		}

		if (input.minLength !== undefined) {
			textInput.setMinLength(input.minLength);
		}

		if (input.maxLength !== undefined) {
			textInput.setMaxLength(input.maxLength);
		}

		modal.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
		);
	}

	return modal;
}
