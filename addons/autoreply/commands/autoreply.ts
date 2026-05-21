import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('autoreply', 'Manage auto replies.', [
	{ name: 'add', description: 'Add auto reply.' },
	{ name: 'remove', description: 'Remove auto reply.' },
	{ name: 'list', description: 'List auto replies.', list: true },
]);
