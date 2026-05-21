import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('streak', 'Track activity streaks.', [
	{ name: 'claim', description: 'Claim streak.' },
	{ name: 'leaderboard', description: 'Show streak leaders.', list: true },
	{ name: 'user', description: 'Show user streak.' },
	{ name: 'restore', description: 'Restore a streak.' },
	{ name: 'settings', description: 'Show streak settings.' },
]);
