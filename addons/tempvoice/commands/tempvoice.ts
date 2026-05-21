import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('tempvoice', 'Manage temporary voice channels.', [
	{ name: 'setup', description: 'Set up temp voice.' },
	{ name: 'limit', description: 'Set user limit.' },
	{ name: 'name', description: 'Rename a temp channel.' },
	{ name: 'privacy', description: 'Set privacy.' },
	{ name: 'kick', description: 'Kick from voice.' },
	{ name: 'transfer', description: 'Transfer ownership.' },
]);
