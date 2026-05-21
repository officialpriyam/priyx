import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('invite', 'Track invite activity.', [
	{ name: 'leaderboard', description: 'Show invite leaders.', list: true },
	{ name: 'user', description: 'Show user invites.' },
	{ name: 'add', description: 'Add invite credit.' },
	{ name: 'remove', description: 'Remove invite credit.' },
	{ name: 'reset', description: 'Reset invite stats.' },
	{ name: 'settings', description: 'Show invite settings.' },
]);
