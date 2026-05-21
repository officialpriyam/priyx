import { createAddonCommand } from '../../../src/utils/commandFactory';

export default createAddonCommand('fun', 'Use Priyx fun commands.', [
	{ name: 'trivia', description: 'Play trivia.' },
	{ name: 'wordle', description: 'Play wordle.' },
	{ name: 'rps', description: 'Rock paper scissors.' },
	{ name: 'meme', description: 'Get a meme.' },
	{ name: 'joke', description: 'Get a joke.' },
	{ name: '8ball', description: 'Ask the 8ball.' },
]);
