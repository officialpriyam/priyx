import type { PriyxButtonHandler } from '../../../src/types/addon';
import type { ModuleName } from '../../../src/types/modules';
import { buttonRow, primaryButton } from '../../../src/utils/components';
import { buildV2Container, componentsV2Flags } from '../../../src/utils/embed';
import {
	replyWithGuildModulePanel,
	updateGuildModuleEnabled,
} from '../../../src/utils/guildModulePanel';

const moduleName = 'core' as const satisfies ModuleName;

const handler: PriyxButtonHandler = {
	customId: 'core:',
	addon: moduleName,
	match: 'prefix',
	async execute(interaction, client) {
		if (interaction.customId.startsWith('core:help:')) {
			return;
		}

		if (interaction.customId === 'core:ping:refresh') {
			const sentAt = Date.now();
			const dbStart = Date.now();
			await client.sequelize.authenticate();
			const dbLatency = Date.now() - dbStart;

			await interaction.update({
				components: [
					buildV2Container({
						title: `${client.module('bot').name} Ping`,
						description: [
							`Bot latency: **${Math.max(0, sentAt - interaction.createdTimestamp)}ms**`,
							`Discord API: **${Math.round(client.ws.ping)}ms**`,
							`Database: **${dbLatency}ms**`,
							`Cache: **${client.cache.kind}**`,
							`Shard: **${interaction.guild?.shardId ?? 0}**`,
						].join('\n'),
						actionRows: [
							buttonRow(primaryButton('core:ping:refresh', 'Refresh')),
						],
					}),
				],
				flags: componentsV2Flags,
			});
			return;
		}

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
