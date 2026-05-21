import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('embed-builder', 'Build and send saved embeds.', [
	{ name: 'create', description: 'Create an embed.' },
	{ name: 'send', description: 'Send a saved embed.' },
	{ name: 'list', description: 'List saved embeds.', list: true },
	{ name: 'edit', description: 'Edit an embed.' },
	{ name: 'delete', description: 'Delete an embed.' },
]);
