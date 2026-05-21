import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('welcomer', 'Configure welcome and farewell flows.', [
	{ name: 'channel', description: 'Set welcome channel.' },
	{ name: 'message', description: 'Set welcome message.' },
	{ name: 'farewell', description: 'Configure farewell messages.' },
	{ name: 'dm', description: 'Configure welcome DMs.' },
	{ name: 'card-on', description: 'Enable welcome cards.' },
	{ name: 'card-off', description: 'Disable welcome cards.' },
	{ name: 'test', description: 'Test welcomer output.' },
]);
