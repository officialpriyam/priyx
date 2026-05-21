import {
	ShardingManager as DiscordShardingManager,
	type ShardingManagerOptions as DiscordShardingOptions,
} from 'discord.js';

export interface CoreShardingOptions
	extends Omit<DiscordShardingOptions, 'token'> {
	scriptPath: string;
	token: string;
}

export class ShardingManager {
	public readonly manager: DiscordShardingManager;
	private readonly shardRestarts = new Map<number, number>();

	public constructor(options: CoreShardingOptions) {
		this.manager = new DiscordShardingManager(options.scriptPath, {
			...options,
			token: options.token,
		});

		this.manager.on('shardCreate', (shard) => {
			this.shardRestarts.set(shard.id, this.getShardRestartCount(shard.id));
			shard.on('death', () => {
				this.shardRestarts.set(
					shard.id,
					this.getShardRestartCount(shard.id) + 1,
				);
			});
		});
	}

	public async spawn(): Promise<void> {
		await this.manager.spawn();
	}

	public async broadcastEval<T>(fn: () => T): Promise<unknown[]> {
		return this.manager.broadcastEval(fn);
	}

	public getShardRestartCount(shardId: number): number {
		return this.shardRestarts.get(shardId) ?? 0;
	}
}
