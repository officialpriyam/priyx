import {
	ComponentType,
	type APIEmbed,
	type ChatInputCommandInteraction,
	type Message,
} from 'discord.js';
import { paginationRow } from './components';

export interface PaginateOptions {
	timeoutMs?: number;
	customIdPrefix?: string;
}

export async function paginate(
	interaction: ChatInputCommandInteraction,
	pages: APIEmbed[],
	options: PaginateOptions = {},
): Promise<void> {
	if (pages.length === 0) {
		return;
	}

	const prefix = options.customIdPrefix ?? `page:${interaction.id}`;
	const timeoutMs = options.timeoutMs ?? 60_000;
	let page = 0;

	const payload = () => ({
		embeds: [pages[page]],
		components:
			pages.length > 1 ? [paginationRow(prefix, page, pages.length)] : [],
	});

	let message: Message;
	if (interaction.deferred || interaction.replied) {
		message = await interaction.editReply(payload());
	} else {
		await interaction.reply(payload());
		message = await interaction.fetchReply();
	}

	if (pages.length <= 1) {
		return;
	}

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (componentInteraction) =>
			componentInteraction.user.id === interaction.user.id &&
			componentInteraction.customId.startsWith(prefix),
		time: timeoutMs,
	});

	collector.on('collect', async (componentInteraction) => {
		const action = componentInteraction.customId.split(':').at(-1);
		if (action === 'previous') {
			page = Math.max(0, page - 1);
		}

		if (action === 'next') {
			page = Math.min(pages.length - 1, page + 1);
		}

		if (action === 'stop') {
			collector.stop('stopped');
			await componentInteraction.update({ components: [] });
			return;
		}

		await componentInteraction.update(payload());
	});

	collector.on('end', async () => {
		await interaction.editReply({ components: [] }).catch(() => undefined);
	});
}
