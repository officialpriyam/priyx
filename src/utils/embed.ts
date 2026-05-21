import {
	ActionRowBuilder,
	ContainerBuilder,
	EmbedBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	ThumbnailBuilder,
	type APIEmbed,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import { colors, hexToDecimal } from '../constants/colors';
import { getModule } from '../modules';

export function primaryEmbed(title: string, description: string): APIEmbed {
	return baseEmbed(title, description, colors.primary);
}

export function successEmbed(title: string, description: string): APIEmbed {
	return baseEmbed(title, description, colors.success);
}

export function warningEmbed(title: string, description: string): APIEmbed {
	return baseEmbed(title, description, colors.warning);
}

export function errorEmbed(title: string, description: string): APIEmbed {
	return baseEmbed(title, description, colors.error);
}

export function infoEmbed(title: string, description: string): APIEmbed {
	return baseEmbed(title, description, colors.info);
}

export function baseEmbed(
	title: string,
	description: string,
	color: number,
): APIEmbed {
	const bot = getModule('bot');
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor(color)
		.setFooter({ text: bot.name })
		.setTimestamp()
		.toJSON();
}

export function textDisplay(content: string): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(content);
}

export function separator(divider = true): SeparatorBuilder {
	return new SeparatorBuilder()
		.setDivider(divider)
		.setSpacing(SeparatorSpacingSize.Small);
}

export function section(
	content: string,
	thumbnailUrl?: string,
): SectionBuilder {
	const builder = new SectionBuilder().addTextDisplayComponents(
		textDisplay(content),
	);

	if (thumbnailUrl) {
		builder.setThumbnailAccessory(
			new ThumbnailBuilder({ media: { url: thumbnailUrl } }),
		);
	}

	return builder;
}

export function mediaGallery(
	items: { url: string; description?: string }[],
): MediaGalleryBuilder {
	return new MediaGalleryBuilder().addItems(
		...items.map(
			(item) =>
				new MediaGalleryItemBuilder({
					description: item.description,
					media: { url: item.url },
				}),
		),
	);
}

export function buildV2Embed(
	title: string,
	sections: string[],
	accentColor?: string,
): ContainerBuilder {
	return buildV2Container({
		title,
		sections,
		accentColor,
	});
}

export const componentsV2Flags: MessageFlags.IsComponentsV2 =
	MessageFlags.IsComponentsV2;

export function componentsV2ReplyFlags(ephemeral = false): number {
	return ephemeral
		? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
		: MessageFlags.IsComponentsV2;
}

export interface V2ContainerOptions {
	title?: string;
	description?: string;
	sections?: string[];
	actionRows?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	footer?: string | false;
	accentColor?: string;
}

export function chunkTextDisplays(
	content: string,
	limit = 3900,
): TextDisplayBuilder[] {
	const normalized = content.trim() || '\u200B';
	const chunks: TextDisplayBuilder[] = [];
	let remaining = normalized;

	while (remaining.length > limit) {
		const breakAt = Math.max(
			remaining.lastIndexOf('\n', limit),
			remaining.lastIndexOf(' ', limit),
		);
		const end = breakAt > 500 ? breakAt : limit;
		chunks.push(textDisplay(remaining.slice(0, end).trim()));
		remaining = remaining.slice(end).trimStart();
	}

	chunks.push(textDisplay(remaining));
	return chunks;
}

export function buildV2Container(
	options: V2ContainerOptions,
): ContainerBuilder {
	const container = new ContainerBuilder().setAccentColor(
		options.accentColor ? hexToDecimal(options.accentColor) : colors.primary,
	);

	if (options.title) {
		container.addTextDisplayComponents(textDisplay(`## ${options.title}`));
	}

	if (options.description) {
		if (options.title) {
			container.addSeparatorComponents(separator());
		}

		container.addTextDisplayComponents(
			...chunkTextDisplays(options.description),
		);
	}

	if (options.sections?.length) {
		if (options.title || options.description) {
			container.addSeparatorComponents(separator());
		}

		for (const item of options.sections) {
			container.addTextDisplayComponents(...chunkTextDisplays(item));
		}
	}

	if (options.actionRows?.length) {
		container.addSeparatorComponents(separator());
		for (const row of options.actionRows) {
			container.addActionRowComponents(row);
		}
	}

	if (options.footer !== false) {
		const footer = options.footer ?? getModule('bot').name;
		container
			.addSeparatorComponents(separator())
			.addTextDisplayComponents(textDisplay(footer));
	}

	return container;
}
