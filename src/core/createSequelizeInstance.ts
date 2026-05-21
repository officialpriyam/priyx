import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import type { ModulesConfig } from '../types/modules';

export function createSequelizeInstance(config: ModulesConfig): Sequelize {
	if (process.env.DATABASE_URL) {
		return new Sequelize(process.env.DATABASE_URL, {
			logging: config.bot.database.logging ? console.log : false,
		});
	}

	const dataDir = path.resolve(process.cwd(), 'data');
	fs.mkdirSync(dataDir, { recursive: true });

	return new Sequelize({
		dialect: 'sqlite',
		storage: path.join(dataDir, 'priyx.sqlite'),
		logging: config.bot.database.logging ? console.log : false,
	});
}
