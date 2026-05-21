import 'dotenv/config';
import { PriyxClient } from './src/client';

const client = new PriyxClient();

client.start().catch((error: unknown) => {
	console.error('Fatal error starting Priyx:', error);
	process.exit(1);
});
