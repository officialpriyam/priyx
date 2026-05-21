import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('giveaway', 'Manage giveaways.', [
	{ name: 'start', description: 'Start a giveaway.' },
	{ name: 'end', description: 'End a giveaway.' },
	{ name: 'cancel', description: 'Cancel a giveaway.' },
	{ name: 'reroll', description: 'Reroll a giveaway.' },
	{ name: 'list', description: 'List giveaways.', list: true },
]);
