import type { PriyxSelectMenuHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import { replyWithGuildModulePanel } from '../../../src/utils/guildModulePanel';
import { titleCase } from '../../../src/utils/string';

const moduleName = 'verification' as const satisfies ModuleName;

const handler: PriyxSelectMenuHandler = {
	customId: 'verification:panel',
	addon: moduleName,
	async execute(interaction, client) {
		const view = interaction.values.at(0) ?? 'config';
		await replyWithGuildModulePanel(
			interaction,
			client,
			moduleName,
			`${titleCase(moduleName)} ${titleCase(view)}`,
		);
	},
};

export default handler;
