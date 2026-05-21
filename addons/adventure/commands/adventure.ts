import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('adventure', 'Play Priyx adventure.', [
	{ name: 'fight', description: 'Start a fight.' },
	{ name: 'shop', description: 'Open the adventure shop.' },
	{ name: 'inventory', description: 'Show inventory.', list: true },
	{ name: 'profile', description: 'Show profile.' },
	{ name: 'start', description: 'Start adventure.' },
	{ name: 'use', description: 'Use an item.' },
]);
