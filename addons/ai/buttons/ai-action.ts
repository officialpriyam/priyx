import { TextInputStyle } from 'discord.js';
import type { PriyxButtonHandler } from '../../../src/types/addon';
import { buildModal } from '../../../src/utils/components';

const handler: PriyxButtonHandler = {
	customId: 'ai:open-chat',
	addon: 'ai',
	async execute(interaction) {
		await interaction.showModal(
			buildModal('ai:chat-modal', 'Chat with Priyx AI', [
				{
					customId: 'prompt',
					label: 'Prompt',
					style: TextInputStyle.Paragraph,
					minLength: 1,
					maxLength: 1500,
					placeholder: 'Ask Priyx something...',
				},
			]),
		);
	},
};

export default handler;
