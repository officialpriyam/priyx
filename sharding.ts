import 'dotenv/config';
import { ShardingManager } from 'discord.js';
import { logger } from './src/logger';
import { getModule } from './src/modules';

const shardConfig = getModule('bot').sharding;

const manager = new ShardingManager('./dist/index.js', {
	token: process.env.DISCORD_TOKEN,
	totalShards: shardConfig.totalShards,
});

manager.on('shardCreate', (shard) => {
	logger.info(`[Shard ${shard.id}] Launched`);
	shard.on('ready', () => logger.info(`[Shard ${shard.id}] Ready`));
	shard.on('death', () => logger.error(`[Shard ${shard.id}] Died`));
	shard.on('error', (error) =>
		logger.error(`[Shard ${shard.id}] Error: ${error.message}`),
	);
});

manager.spawn().catch((error: unknown) => {
	logger.error('Failed to spawn shards:', error);
	process.exit(1);
});
