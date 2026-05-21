import type { QueryInterface } from 'sequelize';
import { BaseMigration } from '../core';

export interface MigrationOptions {
	up: (
		queryInterface: QueryInterface,
		Sequelize: typeof import('sequelize'),
	) => Promise<void>;
	down: (
		queryInterface: QueryInterface,
		Sequelize: typeof import('sequelize'),
	) => Promise<void>;
}

export class PriyxMigration extends BaseMigration {
	public constructor(options: MigrationOptions) {
		super(options);
	}
}
