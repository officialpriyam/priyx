import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('social-alerts', 'Manage social alert polling.', [
	{ name: 'add', description: 'Add a social alert.' },
	{ name: 'remove', description: 'Remove a social alert.' },
	{ name: 'list', description: 'List alerts.', list: true },
	{ name: 'settings', description: 'Show alert settings.' },
]);
