import type { PriyxButtonHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import {
	replyWithGuildModulePanel,
	updateGuildModuleEnabled,
} from '../../../src/utils/guildModulePanel';

const moduleName = 'autoreply' as const satisfies ModuleName;

const handler: PriyxButtonHandler = {
	customId: 'autoreply:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		const action = interaction.customId.split(':').at(-1);
		if (action === 'enable') {
			await updateGuildModuleEnabled(interaction, client, moduleName, true);
			return;
		}

		if (action === 'disable') {
			await updateGuildModuleEnabled(interaction, client, moduleName, false);
			return;
		}

		await replyWithGuildModulePanel(interaction, client, moduleName);
	},
};

export default handler;
