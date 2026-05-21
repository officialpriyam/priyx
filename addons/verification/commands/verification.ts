import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('verification', 'Configure member verification.', [
	{ name: 'setup', description: 'Set up verification.' },
	{ name: 'panel', description: 'Send verification panel.' },
	{ name: 'force', description: 'Force verify a member.' },
	{ name: 'revoke', description: 'Revoke verification.' },
	{ name: 'reset', description: 'Reset verification.' },
	{ name: 'status', description: 'Show verification status.' },
]);
