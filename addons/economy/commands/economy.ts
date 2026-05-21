import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('economy', 'Use Priyx economy commands.', [
	{ name: 'balance', description: 'Show a user balance.' },
	{ name: 'daily', description: 'Claim the daily reward.' },
	{ name: 'work', description: 'Work for coins.' },
	{ name: 'rob', description: 'Attempt a robbery.' },
	{ name: 'deposit', description: 'Deposit coins.' },
	{ name: 'withdraw', description: 'Withdraw coins.' },
	{ name: 'pay', description: 'Pay another user.' },
	{ name: 'leaderboard', description: 'Show economy leaders.', list: true },
	{ name: 'shop', description: 'Open the shop.' },
	{ name: 'buy', description: 'Buy an item.' },
	{ name: 'gamble', description: 'Gamble coins with confirmation.' },
]);
