import type { QueryInterface } from 'sequelize';

export interface BaseMigrationOptions {
	up: (
		queryInterface: QueryInterface,
		Sequelize: typeof import('sequelize'),
	) => Promise<void>;
	down: (
		queryInterface: QueryInterface,
		Sequelize: typeof import('sequelize'),
	) => Promise<void>;
}

export class BaseMigration {
	public readonly up: BaseMigrationOptions['up'];
	public readonly down: BaseMigrationOptions['down'];

	public constructor(options: BaseMigrationOptions) {
		this.up = options.up;
		this.down = options.down;
	}
}
