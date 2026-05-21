import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ChannelSelectMenuBuilder,
	ChannelType,
	ContainerBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	PermissionFlagsBits,
	RoleSelectMenuBuilder,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	type AnySelectMenuInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Guild,
	type GuildMember,
	type MessageActionRowComponentBuilder,
	type ModalSubmitInteraction,
	type TextBasedChannel,
	type TextChannel,
} from 'discord.js';
import type { PriyxClient } from '../../../src/client';
import { colors, hexToDecimal } from '../../../src/constants/colors';
import type {
	ModuleValue,
	TicketModuleConfig,
} from '../../../src/types/modules';
import {
	buttonRow,
	dangerButton,
	primaryButton,
	secondaryButton,
	successButton,
} from '../../../src/utils/components';
import {
	buildV2Container,
	componentsV2ReplyFlags,
} from '../../../src/utils/embed';
import { Ticket } from '../database/models/Ticket';

export interface TicketCategory {
	id: string;
	label: string;
	description?: string;
	emoji?: string;
	channelId?: string;
}

export type TicketPanelStyle = 'button' | 'select';
export type TicketSetupPage = 'edit' | 'target' | 'categories';

export interface TicketPanelOptions {
	title?: string;
	description?: string;
	color?: string;
	image?: string;
	thumbnail?: string;
}

export interface TicketSetupDraft extends TicketPanelOptions {
	guildId: string;
	userId: string;
	categoryType: TicketPanelStyle;
	panelChannelId?: string;
	ticketCategoryId?: string;
	transcriptChannelId?: string;
	logChannelId?: string;
	supportRoleIds: string[];
	maxOpenPerUser?: number;
	categories: TicketCategory[];
	selectedCategoryId?: string;
	createdAt: number;
}

export interface TicketData {
	type?: 'ticket' | 'panel';
	status?: 'open' | 'closed';
	channelId?: string;
	panelChannelId?: string;
	panelMessageId?: string;
	ownerId?: string;
	claimedBy?: string | null;
	reason?: string;
	closedBy?: string;
	closedReason?: string;
	closedAt?: string;
	title?: string;
	description?: string;
	categoryId?: string;
	categoryLabel?: string;
	categoryChannelId?: string;
	panelStyle?: TicketPanelStyle;
	color?: string;
	image?: string;
	thumbnail?: string;
}

type TicketInteraction =
	| ChatInputCommandInteraction
	| ButtonInteraction
	| AnySelectMenuInteraction
	| ModalSubmitInteraction;

interface SendableChannel {
	id: string;
	send(payload: unknown): Promise<unknown>;
}

interface GuildTextLikeChannel extends SendableChannel {
	guild: Guild;
}

const setupDrafts = new Map<string, TicketSetupDraft>();

export function ticketData(ticket: Ticket): TicketData {
	return (ticket.data ?? {}) as TicketData;
}

function safeName(value: string): string {
	const safe = value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return safe || 'ticket';
}

export function makeTicketCategoryId(value: string): string {
	return safeName(value);
}

function textDisplay(content: string): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(content);
}

function separator(divider = true): SeparatorBuilder {
	return new SeparatorBuilder()
		.setDivider(divider)
		.setSpacing(SeparatorSpacingSize.Small);
}

function toActionRow<T extends MessageActionRowComponentBuilder>(
	row: ActionRowBuilder<T>,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return row as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>;
}

function normalizeHexColor(value?: string): string | undefined {
	const color = value?.trim();
	if (!color) {
		return undefined;
	}

	const normalized = color.startsWith('#') ? color : `#${color}`;
	return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : undefined;
}

function isUrl(value?: string): boolean {
	if (!value) {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function componentEmoji(value?: string): string | undefined {
	const emoji = value?.trim();
	if (!emoji || /^[a-z0-9_-]+$/i.test(emoji)) {
		return undefined;
	}

	return emoji;
}

function memberDisplayName(member: GuildMember): string {
	return safeName(member.displayName || member.user.username || member.id);
}

function isSendableChannel(channel: unknown): channel is SendableChannel {
	return (
		typeof channel === 'object' &&
		channel !== null &&
		'id' in channel &&
		'send' in channel &&
		typeof channel.send === 'function'
	);
}

function hasGuild(
	channel: TextBasedChannel,
): channel is TextBasedChannel & GuildTextLikeChannel {
	return (
		'guild' in channel &&
		typeof channel.guild === 'object' &&
		channel.guild !== null
	);
}

function isTextChannel(channel: unknown): channel is TextChannel {
	return (
		typeof channel === 'object' &&
		channel !== null &&
		'type' in channel &&
		channel.type === ChannelType.GuildText
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === 'string' && value.trim().length > 0
		? value.trim()
		: undefined;
}

export function ticketCategories(config: TicketModuleConfig): TicketCategory[] {
	const rawCategories = Array.isArray(config.categories)
		? config.categories
		: [];
	return rawCategories
		.map((entry): TicketCategory | null => {
			if (!isRecord(entry)) {
				return null;
			}

			const id = safeName(
				stringValue(entry, 'id') ?? stringValue(entry, 'label') ?? '',
			);
			const label = stringValue(entry, 'label') ?? id;
			if (!id || !label) {
				return null;
			}

			const category: TicketCategory = {
				id,
				label: label.slice(0, 80),
			};
			const description = stringValue(entry, 'description')?.slice(0, 160);
			if (description) {
				category.description = description;
			}
			const emoji = stringValue(entry, 'emoji')?.slice(0, 32);
			if (emoji) {
				category.emoji = emoji;
			}
			const channelId =
				stringValue(entry, 'channelId') ??
				stringValue(entry, 'categoryId') ??
				stringValue(entry, 'parentId') ??
				stringValue(entry, 'channel');
			if (channelId) {
				category.channelId = channelId;
			}

			return category;
		})
		.filter((category): category is TicketCategory => category !== null)
		.slice(0, 5);
}

export function selectedTicketSetupCategory(
	draft: TicketSetupDraft,
): TicketCategory | undefined {
	const selected = draft.selectedCategoryId
		? draft.categories.find(
				(category) => category.id === draft.selectedCategoryId,
			)
		: undefined;
	return selected ?? draft.categories[0];
}

export function findTicketCategory(
	config: TicketModuleConfig,
	categoryId?: string,
): TicketCategory | undefined {
	if (!categoryId) {
		return undefined;
	}

	const safeCategoryId = safeName(categoryId);
	return ticketCategories(config).find(
		(category) => category.id === safeCategoryId,
	);
}

export function ticketActionRows(
	ticketId: number,
	claimed = false,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	return [
		buttonRow(
			secondaryButton(
				`ticket:claim:${ticketId}`,
				claimed ? 'Claimed' : 'Claim',
			).setDisabled(claimed),
			dangerButton(`ticket:close:${ticketId}`, 'Close'),
			secondaryButton(`ticket:transcript:${ticketId}`, 'Transcript'),
		),
	];
}

export function ticketPanelRows(
	config: TicketModuleConfig,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const categories = ticketCategories(config);
	if (categories.length === 0) {
		return [
			toActionRow<ButtonBuilder>(
				buttonRow(primaryButton('ticket:open', 'Open Ticket')),
			),
		];
	}

	if (config.panelStyle === 'select') {
		const select = new StringSelectMenuBuilder()
			.setCustomId('ticket:open-select')
			.setPlaceholder('Choose a ticket type')
			.addOptions(
				categories.map((category) => {
					const emoji = componentEmoji(category.emoji);
					const option = new StringSelectMenuOptionBuilder()
						.setLabel(category.label)
						.setValue(category.id)
						.setDescription(
							(category.description ?? `Open a ${category.label} ticket`).slice(
								0,
								100,
							),
						);

					if (emoji) {
						option.setEmoji(emoji);
					}

					return option;
				}),
			);

		return [
			toActionRow<StringSelectMenuBuilder>(
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
			),
		];
	}

	return [
		toActionRow<ButtonBuilder>(
			buttonRow(
				...categories.map((category) =>
					primaryButton(
						`ticket:open:${category.id}`,
						category.label,
						componentEmoji(category.emoji),
					),
				),
			),
		),
	];
}

function panelOptionsFromConfig(
	config: TicketModuleConfig,
): TicketPanelOptions {
	const panel = isRecord(config.panel) ? config.panel : {};
	return {
		title: stringValue(panel, 'title'),
		description: stringValue(panel, 'description'),
		color: normalizeHexColor(stringValue(panel, 'color')),
		image: stringValue(panel, 'image'),
		thumbnail: stringValue(panel, 'thumbnail'),
	};
}

function normalizePanelOptions(
	config: TicketModuleConfig,
	titleOrOptions?: string | TicketPanelOptions,
	description?: string,
): TicketPanelOptions {
	const base = panelOptionsFromConfig(config);
	if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
		return {
			...base,
			...titleOrOptions,
			color: normalizeHexColor(titleOrOptions.color) ?? base.color,
		};
	}

	return {
		...base,
		title: titleOrOptions ?? base.title,
		description: description ?? base.description,
	};
}

export function panelContainer(
	config: TicketModuleConfig,
	titleOrOptions?: string | TicketPanelOptions,
	description?: string,
) {
	const options = normalizePanelOptions(config, titleOrOptions, description);
	const categories = ticketCategories(config);
	const categoryLines =
		categories.length > 0
			? [
					'',
					'Choose the ticket type that matches your issue:',
					...categories.map((category) =>
						category.description
							? `**${category.label}:** ${category.description}`
							: `**${category.label}**`,
					),
				]
			: [];
	const title = options.title || 'Support Tickets';
	const body = [
		options.description ||
			'Press a button below to open a private support ticket with the server team.',
		...categoryLines,
	].join('\n');
	const color = normalizeHexColor(options.color);
	const container = new ContainerBuilder().setAccentColor(
		color ? hexToDecimal(color) : colors.primary,
	);

	if (isUrl(options.thumbnail)) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(textDisplay(`## ${title}`))
				.setThumbnailAccessory(
					new ThumbnailBuilder({
						media: { url: options.thumbnail! },
						description: title,
					}),
				),
		);
	} else {
		container.addTextDisplayComponents(textDisplay(`## ${title}`));
	}

	container.addSeparatorComponents(separator());
	container.addTextDisplayComponents(textDisplay(body));

	if (isUrl(options.image)) {
		container.addSeparatorComponents(separator());
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(
				new MediaGalleryItemBuilder({
					media: { url: options.image! },
					description: title,
				}),
			),
		);
	}

	container.addSeparatorComponents(separator());
	for (const row of ticketPanelRows(config)) {
		container.addActionRowComponents(row);
	}

	return container
		.addSeparatorComponents(separator())
		.addTextDisplayComponents(textDisplay('Priyx ticket panel'));
}

export function ticketSetupKey(guildId: string, userId: string): string {
	return `${guildId}:${userId}`;
}

export function getTicketSetupDraft(
	guildId: string,
	userId: string,
): TicketSetupDraft | undefined {
	return setupDrafts.get(ticketSetupKey(guildId, userId));
}

export function deleteTicketSetupDraft(guildId: string, userId: string): void {
	setupDrafts.delete(ticketSetupKey(guildId, userId));
}

export function createTicketSetupDraft(
	guildId: string,
	userId: string,
	config: TicketModuleConfig,
	options: {
		categoryType?: TicketPanelStyle;
		panelChannelId?: string;
		ticketCategoryId?: string;
		transcriptChannelId?: string;
		logChannelId?: string;
		supportRoleId?: string;
		maxOpenPerUser?: number;
		title?: string;
		description?: string;
	} = {},
): TicketSetupDraft {
	const panel = panelOptionsFromConfig(config);
	const supportRoles = (config.supportRoles ?? []).filter(
		(roleId): roleId is string =>
			typeof roleId === 'string' && roleId.length > 0,
	);
	const draft: TicketSetupDraft = {
		guildId,
		userId,
		categoryType:
			options.categoryType ??
			(config.panelStyle === 'select' ? 'select' : 'button'),
		panelChannelId: options.panelChannelId,
		ticketCategoryId: options.ticketCategoryId ?? config.category,
		transcriptChannelId:
			options.transcriptChannelId ?? config.transcriptChannel,
		logChannelId: options.logChannelId ?? config.logChannel,
		supportRoleIds: options.supportRoleId
			? [options.supportRoleId]
			: supportRoles.slice(0, 1),
		maxOpenPerUser: options.maxOpenPerUser ?? config.maxOpenPerUser,
		categories: ticketCategories(config),
		title: options.title ?? panel.title,
		description: options.description ?? panel.description,
		color: panel.color,
		image: panel.image,
		thumbnail: panel.thumbnail,
		createdAt: Date.now(),
	};
	draft.selectedCategoryId = draft.categories[0]?.id;
	setupDrafts.set(ticketSetupKey(guildId, userId), draft);
	return draft;
}

function selectedChannelText(
	channelId?: string,
	fallback = 'Current channel',
): string {
	return channelId ? `<#${channelId}>` : fallback;
}

function selectedRoleText(roleIds: string[]): string {
	return roleIds.length > 0
		? roleIds.map((roleId) => `<@&${roleId}>`).join(', ')
		: 'Manage Channels / Manage Server';
}

function setupCategorySummary(draft: TicketSetupDraft): string {
	if (draft.categories.length === 0) {
		return 'No ticket buttons or dropdown options are configured yet. Add one before saving the panel.';
	}

	return draft.categories
		.map((category) => {
			const selected =
				category.id === selectedTicketSetupCategory(draft)?.id
					? 'Selected: '
					: '';
			const target = category.channelId
				? `<#${category.channelId}>`
				: draft.ticketCategoryId
					? `fallback <#${draft.ticketCategoryId}>`
					: 'not set';
			const description = category.description
				? ` - ${category.description}`
				: '';
			return `${selected}${category.label}${description} -> ${target}`;
		})
		.join('\n');
}

function setupSummary(draft: TicketSetupDraft, page: TicketSetupPage): string {
	if (page === 'categories') {
		return [
			'Configure the buttons or dropdown options shown on the ticket panel.',
			'Each item can open tickets inside its own Discord category. If no item category is set, the fallback ticket category is used.',
			'',
			setupCategorySummary(draft),
		].join('\n');
	}

	const targetPage = page === 'target';
	return [
		'Please enter the requested information as prompted. This panel automatically updates with the information you provide.',
		'',
		`Panel type: **${draft.categoryType === 'select' ? 'Select Menu' : 'Button'}**`,
		`Panel channel: **${selectedChannelText(draft.panelChannelId)}**`,
		`Ticket category: **${selectedChannelText(draft.ticketCategoryId, 'Not set')}**`,
		`Transcript channel: **${selectedChannelText(draft.transcriptChannelId, 'Not set')}**`,
		`Support access: **${selectedRoleText(draft.supportRoleIds)}**`,
		`Title: **${draft.title || 'Support Tickets'}**`,
		`Description: **${draft.description ? 'Set' : 'Default'}**`,
		`Color: **${normalizeHexColor(draft.color) ?? '#6C63FF'}**`,
		`Image: **${draft.image ? 'Set' : 'Not set'}**`,
		`Thumbnail: **${draft.thumbnail ? 'Set' : 'Not set'}**`,
		`Categories: **${draft.categories.length || 1}**`,
		targetPage
			? 'Select the posting channel, fallback ticket category, and support role below, then save.'
			: 'Use the buttons below to edit the panel, buttons, or dropdown options, then save and set category.',
	].join('\n');
}

function setupEditRows(
	draft: TicketSetupDraft,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const userId = draft.userId;
	return [
		toActionRow<ButtonBuilder>(
			buttonRow(
				primaryButton(`ticket:setup:title:${userId}`, 'Title'),
				primaryButton(`ticket:setup:description:${userId}`, 'Description'),
				primaryButton(`ticket:setup:color:${userId}`, 'Color'),
			),
		),
		toActionRow<ButtonBuilder>(
			buttonRow(
				secondaryButton(`ticket:setup:image:${userId}`, 'Image'),
				secondaryButton(`ticket:setup:thumbnail:${userId}`, 'Thumbnail'),
				successButton(`ticket:setup:json:${userId}`, 'JSON'),
			),
		),
		toActionRow<ButtonBuilder>(
			buttonRow(
				primaryButton(`ticket:setup:categories:${userId}`, 'Buttons'),
				successButton(`ticket:setup:target:${userId}`, 'Save & Set Category'),
				dangerButton(`ticket:setup:exit:${userId}`, 'Exit'),
			),
		),
	];
}

function setupCategoryRows(
	draft: TicketSetupDraft,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const userId = draft.userId;
	const selected = selectedTicketSetupCategory(draft);
	const categorySelect = new StringSelectMenuBuilder()
		.setCustomId(`ticket:setup:category-select:${userId}`)
		.setPlaceholder(
			selected
				? `Editing: ${selected.label}`
				: 'Choose a panel button or dropdown option',
		)
		.setMinValues(1)
		.setMaxValues(1)
		.setDisabled(draft.categories.length === 0);

	if (draft.categories.length === 0) {
		categorySelect.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel('No buttons configured')
				.setValue('none')
				.setDescription('Add a button first.'),
		);
	} else {
		categorySelect.addOptions(
			draft.categories.slice(0, 5).map((category) => {
				const option = new StringSelectMenuOptionBuilder()
					.setLabel(category.label)
					.setValue(category.id)
					.setDescription(
						(category.description ?? 'Edit this panel item').slice(0, 100),
					);
				const emoji = componentEmoji(category.emoji);
				if (emoji) {
					option.setEmoji(emoji);
				}
				return option;
			}),
		);
	}

	return [
		toActionRow<StringSelectMenuBuilder>(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				categorySelect,
			),
		),
		toActionRow<ChannelSelectMenuBuilder>(
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId(`ticket:setup:category-target:${userId}`)
					.setPlaceholder(
						selected
							? `Discord category for ${selected.label}`
							: 'Add a button before selecting its category',
					)
					.setMinValues(0)
					.setMaxValues(1)
					.setDisabled(!selected)
					.addChannelTypes(ChannelType.GuildCategory),
			),
		),
		toActionRow<ButtonBuilder>(
			buttonRow(
				successButton(`ticket:setup:category-add:${userId}`, 'Add'),
				primaryButton(`ticket:setup:category-edit:${userId}`, 'Edit'),
				dangerButton(`ticket:setup:category-remove:${userId}`, 'Remove'),
			),
		),
		toActionRow<ButtonBuilder>(
			buttonRow(
				secondaryButton(`ticket:setup:back:${userId}`, 'Back'),
				successButton(`ticket:setup:target:${userId}`, 'Save & Set Category'),
				dangerButton(`ticket:setup:exit:${userId}`, 'Exit'),
			),
		),
	];
}

function setupTargetRows(
	draft: TicketSetupDraft,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const userId = draft.userId;
	return [
		toActionRow<ChannelSelectMenuBuilder>(
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId(`ticket:setup:panel-channel:${userId}`)
					.setPlaceholder('Select where to post the ticket panel')
					.setMinValues(1)
					.setMaxValues(1)
					.addChannelTypes(
						ChannelType.GuildText,
						ChannelType.GuildAnnouncement,
					),
			),
		),
		toActionRow<ChannelSelectMenuBuilder>(
			new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId(`ticket:setup:ticket-category:${userId}`)
					.setPlaceholder('Select ticket category channel')
					.setMinValues(0)
					.setMaxValues(1)
					.addChannelTypes(ChannelType.GuildCategory),
			),
		),
		toActionRow<RoleSelectMenuBuilder>(
			new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
				new RoleSelectMenuBuilder()
					.setCustomId(`ticket:setup:support-role:${userId}`)
					.setPlaceholder('Select support role')
					.setMinValues(0)
					.setMaxValues(1),
			),
		),
		toActionRow<ButtonBuilder>(
			buttonRow(
				successButton(`ticket:setup:save:${userId}`, 'Save Panel'),
				secondaryButton(`ticket:setup:back:${userId}`, 'Back'),
				dangerButton(`ticket:setup:exit:${userId}`, 'Exit'),
			),
		),
	];
}

export function ticketSetupContainer(
	draft: TicketSetupDraft,
	pageOrTarget: TicketSetupPage | boolean = 'edit',
): ContainerBuilder {
	const page =
		typeof pageOrTarget === 'boolean'
			? pageOrTarget
				? 'target'
				: 'edit'
			: pageOrTarget;
	const title =
		page === 'target'
			? 'Ticket Panel Target'
			: page === 'categories'
				? 'Ticket Panel Buttons'
				: 'Ticket Panel Setup';
	const actionRows =
		page === 'target'
			? setupTargetRows(draft)
			: page === 'categories'
				? setupCategoryRows(draft)
				: setupEditRows(draft);

	return buildV2Container({
		title,
		description: setupSummary(draft, page),
		actionRows,
		accentColor: normalizeHexColor(draft.color),
		footer: 'Priyx ticket setup',
	});
}

export function ticketSetupPatchFromDraft(
	draft: TicketSetupDraft,
): Record<string, ModuleValue> {
	const panel: Record<string, ModuleValue> = {};
	if (draft.title) {
		panel.title = draft.title;
	}
	if (draft.description) {
		panel.description = draft.description;
	}
	const color = normalizeHexColor(draft.color);
	if (color) {
		panel.color = color;
	}
	if (isUrl(draft.image)) {
		panel.image = draft.image;
	}
	if (isUrl(draft.thumbnail)) {
		panel.thumbnail = draft.thumbnail;
	}

	const patch: Record<string, ModuleValue> = {
		panelStyle: draft.categoryType,
		panel,
		categories: draft.categories.map((category) => {
			const serialized: Record<string, ModuleValue> = {
				id: category.id,
				label: category.label,
			};
			if (category.description) {
				serialized.description = category.description;
			}
			if (category.emoji) {
				serialized.emoji = category.emoji;
			}
			if (category.channelId) {
				serialized.channelId = category.channelId;
			}
			return serialized;
		}),
	};

	if (draft.ticketCategoryId) {
		patch.category = draft.ticketCategoryId;
	}
	if (draft.supportRoleIds.length > 0) {
		patch.supportRoles = draft.supportRoleIds;
	}
	if (draft.transcriptChannelId) {
		patch.transcriptChannel = draft.transcriptChannelId;
	}
	if (draft.logChannelId) {
		patch.logChannel = draft.logChannelId;
	}
	if (draft.maxOpenPerUser !== undefined) {
		patch.maxOpenPerUser = draft.maxOpenPerUser;
	}

	return patch;
}

export function updateTicketSetupDraftFromJson(
	draft: TicketSetupDraft,
	rawJson: string,
): void {
	const parsed = JSON.parse(rawJson) as unknown;
	if (!isRecord(parsed)) {
		throw new Error('JSON must be an object.');
	}

	const title = stringValue(parsed, 'title');
	if (title !== undefined) {
		draft.title = title.slice(0, 80);
	}
	const description = stringValue(parsed, 'description');
	if (description !== undefined) {
		draft.description = description.slice(0, 1500);
	}
	const color = normalizeHexColor(stringValue(parsed, 'color'));
	if (color) {
		draft.color = color;
	}
	const image = stringValue(parsed, 'image');
	if (image !== undefined) {
		draft.image = image;
	}
	const thumbnail = stringValue(parsed, 'thumbnail');
	if (thumbnail !== undefined) {
		draft.thumbnail = thumbnail;
	}
	const categoryType =
		stringValue(parsed, 'categoryType') ?? stringValue(parsed, 'category-type');
	if (categoryType === 'button' || categoryType === 'select') {
		draft.categoryType = categoryType;
	}
	if (Array.isArray(parsed.categories)) {
		draft.categories = ticketCategories({
			enabled: true,
			categories: parsed.categories as ModuleValue[],
		});
		draft.selectedCategoryId = draft.categories[0]?.id;
	}
}

export async function replyTicket(
	interaction: TicketInteraction,
	title: string,
	description: string,
	ephemeral = true,
) {
	const payload = {
		components: [
			buildV2Container({
				title,
				description,
				footer: 'Priyx tickets',
			}),
		],
		flags: componentsV2ReplyFlags(ephemeral),
	};

	if (interaction.deferred || interaction.replied) {
		await interaction.editReply(payload);
		return;
	}

	await interaction.reply(payload);
}

export async function findOpenTicketForUser(
	guildId: string,
	userId: string,
): Promise<Ticket | null> {
	const tickets = await Ticket.findAll({ where: { guildId, userId } });
	return (
		tickets.find((ticket) => {
			const data = ticketData(ticket);
			return data.type === 'ticket' && data.status === 'open' && data.channelId;
		}) ?? null
	);
}

export async function findTicketByChannel(
	guildId: string,
	channelId: string,
): Promise<Ticket | null> {
	const tickets = await Ticket.findAll({ where: { guildId } });
	return (
		tickets.find((ticket) => {
			const data = ticketData(ticket);
			return data.type === 'ticket' && data.channelId === channelId;
		}) ?? null
	);
}

export async function findTicketById(
	guildId: string,
	ticketId: number,
): Promise<Ticket | null> {
	const ticket = await Ticket.findOne({ where: { id: ticketId, guildId } });
	if (!ticket || ticketData(ticket).type !== 'ticket') {
		return null;
	}

	return ticket;
}

export async function isTicketStaff(
	member: GuildMember,
	config: TicketModuleConfig,
): Promise<boolean> {
	if (
		member.permissions.has(PermissionFlagsBits.ManageGuild) ||
		member.permissions.has(PermissionFlagsBits.ManageChannels)
	) {
		return true;
	}

	const supportRoles = (config.supportRoles ?? []).filter(
		(roleId): roleId is string =>
			typeof roleId === 'string' && roleId.length > 0,
	);
	return supportRoles.some((roleId) => member.roles.cache.has(roleId));
}

export async function ensureTicketMember(
	interaction: TicketInteraction,
): Promise<GuildMember | null> {
	if (!interaction.guild) {
		await replyTicket(
			interaction,
			'Server only',
			'Tickets can only be used in a server.',
		);
		return null;
	}

	const member = await interaction.guild.members
		.fetch(interaction.user.id)
		.catch(() => null);
	if (!member) {
		await replyTicket(
			interaction,
			'Member unavailable',
			'Could not load your server member data.',
		);
		return null;
	}

	return member;
}

export async function createTicketChannel(
	client: PriyxClient,
	guild: Guild,
	member: GuildMember,
	config: TicketModuleConfig,
	reason?: string,
	category?: TicketCategory,
): Promise<Ticket> {
	const maxOpen = Number(config.maxOpenPerUser ?? 1);
	if (maxOpen > 0) {
		const tickets = await Ticket.findAll({
			where: { guildId: guild.id, userId: member.id },
		});
		const openTickets = tickets.filter((ticket) => {
			const data = ticketData(ticket);
			return data.type === 'ticket' && data.status === 'open' && data.channelId;
		});
		if (openTickets.length >= maxOpen) {
			const firstOpen = ticketData(openTickets[0]);
			throw new Error(
				`You already have an open ticket: <#${firstOpen.channelId}>`,
			);
		}
	}

	const supportRoles = (config.supportRoles ?? []).filter(
		(roleId): roleId is string =>
			typeof roleId === 'string' && roleId.length > 0,
	);
	const botId = guild.members.me?.id ?? client.user?.id;
	const overwrites = [
		{
			id: guild.roles.everyone.id,
			deny: [PermissionFlagsBits.ViewChannel],
		},
		{
			id: member.id,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.AttachFiles,
			],
		},
		...supportRoles.map((roleId) => ({
			id: roleId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.ManageMessages,
			],
		})),
	];

	if (botId) {
		overwrites.push({
			id: botId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.ManageChannels,
				PermissionFlagsBits.AttachFiles,
			],
		});
	}

	const channel = await guild.channels.create({
		name: (config.naming ?? 'ticket-{username}')
			.replace('{username}', memberDisplayName(member))
			.replace('{user}', memberDisplayName(member)),
		type: ChannelType.GuildText,
		parent: category?.channelId || config.category || undefined,
		reason: `Ticket opened by ${member.user.tag}`,
		permissionOverwrites: overwrites,
	});

	const ticket = await Ticket.create({
		guildId: guild.id,
		userId: member.id,
		data: {
			type: 'ticket',
			status: 'open',
			channelId: channel.id,
			ownerId: member.id,
			claimedBy: null,
			reason: reason || 'No reason provided.',
			categoryId: category?.id,
			categoryLabel: category?.label,
			categoryChannelId: category?.channelId,
		},
	});

	await channel.send({
		components: [
			buildV2Container({
				title: `Ticket #${ticket.id}`,
				description: [
					`Owner: ${member}`,
					category ? `Type: ${category.label}` : undefined,
					`Reason: ${reason || 'No reason provided.'}`,
					supportRoles.length > 0
						? `Support: ${supportRoles.map((roleId) => `<@&${roleId}>`).join(', ')}`
						: 'Support: members with Manage Channels',
				]
					.filter(Boolean)
					.join('\n'),
				actionRows: ticketActionRows(ticket.id),
				footer: 'Priyx tickets',
			}),
		],
		flags: MessageFlags.IsComponentsV2,
	});

	return ticket;
}

export async function closeTicket(
	client: PriyxClient,
	ticket: Ticket,
	closedBy: string,
	reason = 'No reason provided.',
): Promise<void> {
	const data = ticketData(ticket);
	ticket.data = {
		...data,
		status: 'closed',
		closedBy,
		closedReason: reason,
		closedAt: new Date().toISOString(),
	};
	ticket.changed('data', true);
	await ticket.save();

	if (!data.channelId) {
		return;
	}

	const guild = client.guilds.cache.get(ticket.guildId);
	const channel = guild?.channels.cache.get(data.channelId);
	if (!isTextChannel(channel)) {
		return;
	}

	await channel
		.send({
			components: [
				buildV2Container({
					title: 'Ticket closed',
					description: `Closed by <@${closedBy}>.\nReason: ${reason}`,
					footer: 'Priyx tickets',
				}),
			],
			flags: MessageFlags.IsComponentsV2,
		})
		.catch(() => undefined);

	setTimeout(() => {
		channel.delete(`Ticket #${ticket.id} closed`).catch(() => undefined);
	}, 5000).unref();
}

export async function createTranscriptAttachment(
	channel: TextBasedChannel,
	ticket: Ticket,
): Promise<AttachmentBuilder> {
	if (
		!('messages' in channel) ||
		typeof channel.messages?.fetch !== 'function'
	) {
		throw new Error('This channel does not support message transcripts.');
	}

	const messages = await channel.messages.fetch({ limit: 100 });
	const lines = [...messages.values()]
		.sort((left, right) => left.createdTimestamp - right.createdTimestamp)
		.map((message) => {
			const stamp = new Date(message.createdTimestamp).toISOString();
			const content = message.content || '[no text content]';
			return `[${stamp}] ${message.author.tag}: ${content}`;
		});

	const buffer = Buffer.from(lines.join('\n'), 'utf8');
	return new AttachmentBuilder(buffer, {
		name: `ticket-${ticket.id}-transcript.txt`,
	});
}

export async function sendTranscript(
	client: PriyxClient,
	ticket: Ticket,
	channel: TextBasedChannel,
	config: TicketModuleConfig,
): Promise<void> {
	const attachment = await createTranscriptAttachment(channel, ticket);
	const targetId = config.transcriptChannel || config.logChannel;
	if (!targetId || !hasGuild(channel)) {
		if (!isSendableChannel(channel)) {
			throw new Error('This channel cannot receive transcripts.');
		}

		await channel.send({ files: [attachment] });
		return;
	}

	const target = channel.guild.channels.cache.get(targetId);
	if (isSendableChannel(target)) {
		await target.send({
			components: [
				buildV2Container({
					title: `Ticket #${ticket.id} transcript`,
					description: `Owner: <@${ticket.userId}>`,
					footer: 'Priyx tickets',
				}),
			],
			files: [attachment],
			flags: MessageFlags.IsComponentsV2,
		});
		return;
	}

	client
		.addonLogger('ticket')
		.warn(`Transcript channel ${targetId} is not sendable.`);
	await channel.send({ files: [attachment] });
}

export const TicketHelper = {
	cacheKey(...parts: string[]): string {
		return ['ticket', ...parts].join(':');
	},
	closeTicket,
	createTicketSetupDraft,
	createTicketChannel,
	createTranscriptAttachment,
	deleteTicketSetupDraft,
	findTicketCategory,
	findOpenTicketForUser,
	findTicketByChannel,
	findTicketById,
	getTicketSetupDraft,
	isTicketStaff,
	makeTicketCategoryId,
	panelContainer,
	replyTicket,
	sendTranscript,
	selectedTicketSetupCategory,
	ticketCategories,
	ticketData,
	ticketPanelRows,
	ticketSetupContainer,
	ticketSetupKey,
	ticketSetupPatchFromDraft,
	updateTicketSetupDraftFromJson,
};
