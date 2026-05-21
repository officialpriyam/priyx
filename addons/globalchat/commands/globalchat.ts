import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('globalchat', 'Manage global chat.', [
	{ name: 'setup', description: 'Set up global chat.' },
	{ name: 'remove', description: 'Remove global chat.' },
	{ name: 'info', description: 'Show global chat info.' },
]);
