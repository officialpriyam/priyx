import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('suggestion', 'Manage server suggestions.', [
	{ name: 'submit', description: 'Submit a suggestion.' },
	{ name: 'approve', description: 'Approve a suggestion.' },
	{ name: 'deny', description: 'Deny a suggestion.' },
	{ name: 'leaderboard', description: 'Show suggestion stats.', list: true },
	{ name: 'settings', description: 'Show suggestion settings.' },
]);
