import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('image', 'Manage image assets.', [
	{ name: 'add', description: 'Add an image.' },
	{ name: 'delete', description: 'Delete an image.' },
	{ name: 'list', description: 'List images.', list: true },
]);
