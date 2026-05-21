import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('leveling', 'Use Priyx leveling commands.', [
	{ name: 'rank', description: 'Show a rank card.' },
	{ name: 'leaderboard', description: 'Show XP leaders.', list: true },
	{ name: 'setlevelrole', description: 'Set a level role.' },
	{ name: 'levelconfig', description: 'Show leveling configuration.' },
]);
