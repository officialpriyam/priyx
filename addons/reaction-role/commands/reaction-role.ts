import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('reaction-role', 'Manage reaction role panels.', [
	{ name: 'create', description: 'Create a panel.' },
	{ name: 'add', description: 'Add a role option.' },
	{ name: 'remove', description: 'Remove a role option.' },
	{ name: 'list', description: 'List panels.', list: true },
]);
