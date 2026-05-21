import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('birthday', 'Manage birthday reminders.', [
	{ name: 'set', description: 'Set birthday.' },
	{ name: 'remove', description: 'Remove birthday.' },
	{ name: 'list', description: 'List birthdays.', list: true },
	{ name: 'check', description: 'Check birthdays.' },
	{ name: 'settings', description: 'Show birthday settings.' },
]);
