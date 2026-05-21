import { Events } from 'discord.js';
import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
	name: Events.ClientReady,
	once: true,
	addon: 'core',
	async execute(client) {
		client.logger.info(
			[
				'',
				'==================== PRIYX ONLINE ====================',
				`Bot:       ${client.user?.tag ?? 'unknown'}`,
				`Version:   ${client.modules.bot.version}`,
				`Guilds:    ${client.guilds.cache.size}`,
				`Commands:  ${client.commands.size}`,
				`Buttons:   ${client.buttons.size}`,
				`Menus:     ${client.selectMenus.size}`,
				`Modals:    ${client.modals.size}`,
				`Runtime:   Node ${process.version}`,
				'Logs:      logs/combined.log, logs/error.log, logs/addons/',
				'======================================================',
			].join('\n'),
		);
	},
});
