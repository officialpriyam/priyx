import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('pet', 'Care for Priyx pets.', [
	{ name: 'status', description: 'Show pet status.' },
	{ name: 'feed', description: 'Feed a pet.' },
	{ name: 'play', description: 'Play with a pet.' },
	{ name: 'gacha', description: 'Roll for a pet.' },
	{ name: 'adopt', description: 'Adopt a pet.' },
	{ name: 'info', description: 'Show pet info.' },
]);
