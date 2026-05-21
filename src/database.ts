import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sequelize, type Options, type QueryOptions } from 'sequelize';
import type { BotModuleConfig } from './types/modules';

export function quotePostgresIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

export function databaseSchema(): string {
	const configured = process.env.DATABASE_SCHEMA?.trim();
	if (configured) {
		return configured;
	}

	if (process.env.DATABASE_URL) {
		try {
			const username = new URL(process.env.DATABASE_URL).username;
			if (username) {
				return decodeURIComponent(username);
			}
		} catch {
			return 'public';
		}
	}

	return 'public';
}

export function createDatabase(config: BotModuleConfig['database']): Sequelize {
	if (process.env.DATABASE_URL) {
		const schema = databaseSchema();
		return new Sequelize(process.env.DATABASE_URL, {
			dialectOptions: {
				options: `-c search_path=${schema}`,
				prependSearchPath: true,
			},
			hooks: {
				afterConnect(connection: unknown) {
					if (
						typeof connection === 'object' &&
						connection !== null &&
						'query' in connection &&
						typeof connection.query === 'function'
					) {
						return connection.query(
							`SET search_path TO ${quotePostgresIdentifier(schema)}`,
						);
					}

					return undefined;
				},
			},
			searchPath: quotePostgresIdentifier(schema),
			logging: config.logging ? console.log : false,
		} as unknown as Options);
	}

	const dataDir = path.resolve(process.cwd(), 'data');
	fs.mkdirSync(dataDir, { recursive: true });

	return new Sequelize({
		dialect: 'sqlite',
		storage: path.join(dataDir, 'priyx.sqlite'),
		logging: config.logging ? console.log : false,
	});
}

export async function prepareDatabase(sequelize: Sequelize): Promise<void> {
	if (sequelize.getDialect() !== 'postgres') {
		return;
	}

	const schema = databaseSchema();
	await sequelize.query(
		`CREATE SCHEMA IF NOT EXISTS ${quotePostgresIdentifier(schema)}`,
		{ supportsSearchPath: false } as unknown as QueryOptions,
	);
	await sequelize.query(
		`SET search_path TO ${quotePostgresIdentifier(schema)}`,
		{ supportsSearchPath: false } as unknown as QueryOptions,
	);
}

async function collectModelFiles(root: string, ext: string): Promise<string[]> {
	try {
		const entries = await fsp.readdir(root, { withFileTypes: true });
		const files = await Promise.all(
			entries.map(async (entry) => {
				const fullPath = path.join(root, entry.name);
				if (entry.isDirectory()) {
					return collectModelFiles(fullPath, ext);
				}

				return entry.isFile() && entry.name.endsWith(ext) ? [fullPath] : [];
			}),
		);
		return files.flat();
	} catch {
		return [];
	}
}

export async function initializeModels(sequelize: Sequelize): Promise<void> {
	const ext = path.extname(__filename);
	const root = path.resolve(
		process.cwd(),
		ext === '.ts' ? 'addons' : path.join('dist', 'addons'),
	);
	const files = (await collectModelFiles(root, ext)).filter((file) =>
		file.includes(`${path.sep}database${path.sep}models${path.sep}`),
	);

	for (const file of files) {
		const imported = (await import(pathToFileURL(file).href)) as Record<
			string,
			unknown
		>;
		for (const value of Object.values(imported)) {
			if (
				typeof value === 'function' &&
				'initModel' in value &&
				typeof value.initModel === 'function'
			) {
				value.initModel(sequelize);
			}
		}
	}
}
