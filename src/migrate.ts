import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as SequelizeModule from 'sequelize';
import {
	createDatabase,
	databaseSchema,
	prepareDatabase,
	quotePostgresIdentifier,
} from './database';
import { logger } from './logger';
import { getModule } from './modules';
import type { MigrationOptions } from './structures/Migration';

const migrationTable = 'priyx_migrations';

interface MigrationFile {
	addon: string;
	file: string;
	name: string;
	relativePath: string;
}

interface MigrationCliOptions {
	addon?: string;
}

interface MigrationRow {
	name: string;
}

type SchemaTableRef = string | { tableName?: string; name?: string; schema?: string };

async function exists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

function tableName(value: unknown): string | null {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value !== 'object' || value === null) {
		return null;
	}

	const record = value as Record<string, unknown>;
	if (typeof record.tableName === 'string') {
		return record.tableName;
	}

	if (typeof record.name === 'string') {
		return record.name;
	}

	return null;
}

function schemaTableName(table: SchemaTableRef): SchemaTableRef {
	if (typeof table === 'string') {
		return { tableName: table, schema: databaseSchema() };
	}

	if (typeof table === 'object' && table !== null && !table.schema) {
		return { ...table, schema: databaseSchema() };
	}

	return table;
}

function qualifiedMigrationTable(): string {
	return [
		quotePostgresIdentifier(databaseSchema()),
		quotePostgresIdentifier(migrationTable),
	].join('.');
}

function parseArgs(args: string[]): MigrationCliOptions {
	const options: MigrationCliOptions = {};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--addon' || arg === '-addon' || arg === '-a') {
			options.addon = args[index + 1];
			index += 1;
			continue;
		}

		if (arg.startsWith('--addon=')) {
			options.addon = arg.slice('--addon='.length);
			continue;
		}

		if (arg.startsWith('-addon=')) {
			options.addon = arg.slice('-addon='.length);
		}
	}

	return options;
}

async function collectFiles(root: string): Promise<string[]> {
	if (!(await exists(root))) {
		return [];
	}

	const entries = await fs.readdir(root, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(root, entry.name);
			if (entry.isDirectory()) {
				return collectFiles(fullPath);
			}

			return entry.isFile() && /\.([cm]?js|ts)$/.test(entry.name)
				? [fullPath]
				: [];
		}),
	);

	return files.flat();
}

async function collectMigrations(
	root: string,
	options: MigrationCliOptions,
): Promise<MigrationFile[]> {
	const files = await collectFiles(root);
	const migrations = files
		.filter((file) =>
			file.includes(`${path.sep}database${path.sep}migrations${path.sep}`),
		)
		.map((file) => {
			const relativePath = path.relative(process.cwd(), file);
			const parts = path.relative(root, file).split(path.sep);
			const addon = parts[0];
			return {
				addon,
				file,
				name: relativePath.replaceAll(path.sep, '/'),
				relativePath,
			};
		})
		.filter((migration) =>
			options.addon ? migration.addon === options.addon : true,
		)
		.sort((left, right) => left.name.localeCompare(right.name));

	return migrations;
}

function applyDefaultSchema(
	sequelize: SequelizeModule.Sequelize,
	queryInterface: SequelizeModule.QueryInterface,
): SequelizeModule.QueryInterface {
	if (sequelize.getDialect() !== 'postgres') {
		return queryInterface;
	}

	const patched = queryInterface as unknown as {
		createTable: (
			tableName: SchemaTableRef,
			attributes: unknown,
			options?: unknown,
			model?: unknown,
		) => Promise<unknown>;
		addIndex: (
			tableName: SchemaTableRef,
			attributes: unknown,
			options?: unknown,
			rawTableName?: SchemaTableRef,
		) => Promise<unknown>;
		dropTable: (tableName: SchemaTableRef, options?: unknown) => Promise<unknown>;
		bulkInsert: (
			tableName: SchemaTableRef,
			records: unknown[],
			options?: unknown,
			attributes?: unknown,
		) => Promise<unknown>;
	};

	const createTable = patched.createTable.bind(queryInterface);
	const addIndex = patched.addIndex.bind(queryInterface);
	const dropTable = patched.dropTable.bind(queryInterface);
	const bulkInsert = patched.bulkInsert.bind(queryInterface);

	patched.createTable = (tableName, attributes, options, model) =>
		createTable(schemaTableName(tableName), attributes, options, model);
	patched.addIndex = (tableName, attributes, options, rawTableName) =>
		addIndex(
			schemaTableName(tableName),
			attributes,
			options,
			rawTableName ? schemaTableName(rawTableName) : undefined,
		);
	patched.dropTable = (tableName, options) =>
		dropTable(schemaTableName(tableName), options);
	patched.bulkInsert = (tableName, records, options, attributes) =>
		bulkInsert(schemaTableName(tableName), records, options, attributes);

	return queryInterface;
}

async function ensureMigrationTable(
	queryInterface: SequelizeModule.QueryInterface,
): Promise<void> {
	const tables = await queryInterface.showAllTables();
	const hasTable = tables.some((table) => tableName(table) === migrationTable);
	if (hasTable) {
		return;
	}

	await queryInterface.createTable(migrationTable, {
		name: {
			type: SequelizeModule.DataTypes.STRING,
			allowNull: false,
			primaryKey: true,
		},
		addon: {
			type: SequelizeModule.DataTypes.STRING,
			allowNull: false,
		},
		path: {
			type: SequelizeModule.DataTypes.TEXT,
			allowNull: false,
		},
		runAt: {
			type: SequelizeModule.DataTypes.DATE,
			allowNull: false,
			defaultValue: SequelizeModule.DataTypes.NOW,
		},
	});
}

async function appliedMigrations(
	sequelize: SequelizeModule.Sequelize,
): Promise<Set<string>> {
	const rows = await sequelize.query<MigrationRow>(
		`SELECT "name" FROM ${qualifiedMigrationTable()}`,
		{ type: SequelizeModule.QueryTypes.SELECT },
	);

	return new Set(rows.map((row) => row.name));
}

async function loadMigration(file: string): Promise<MigrationOptions | null> {
	const imported = (await import(pathToFileURL(file).href)) as {
		default?: MigrationOptions;
		up?: MigrationOptions['up'];
		down?: MigrationOptions['down'];
	};
	const migration = imported.default ?? imported;

	return typeof migration.up === 'function' && typeof migration.down === 'function'
		? (migration as MigrationOptions)
		: null;
}

export async function runMigrations(
	options: MigrationCliOptions = {},
): Promise<void> {
	const sequelize = createDatabase(getModule('bot').database);
	const queryInterface = applyDefaultSchema(
		sequelize,
		sequelize.getQueryInterface(),
	);

	await sequelize.authenticate();
	await prepareDatabase(sequelize);
	await ensureMigrationTable(queryInterface);

	const root = path.resolve(process.cwd(), 'addons');
	const migrations = await collectMigrations(root, options);
	if (options.addon && migrations.length === 0) {
		logger.warn(`No migrations found for addon "${options.addon}".`);
		await sequelize.close();
		return;
	}

	const applied = await appliedMigrations(sequelize);
	let ran = 0;

	for (const migrationFile of migrations) {
		if (applied.has(migrationFile.name)) {
			logger.info(`Skipping applied migration ${migrationFile.relativePath}`);
			continue;
		}

		const migration = await loadMigration(migrationFile.file);
		if (!migration) {
			logger.warn(`Skipping invalid migration ${migrationFile.relativePath}`);
			continue;
		}

		logger.info(`Running migration ${migrationFile.relativePath}`);
		await migration.up(queryInterface, SequelizeModule);
		await queryInterface.bulkInsert(migrationTable, [
			{
				name: migrationFile.name,
				addon: migrationFile.addon,
				path: migrationFile.relativePath,
				runAt: new Date(),
			},
		]);
		ran += 1;
	}

	logger.info(`Migration complete. Applied ${ran} migration(s).`);
	await sequelize.close();
}

if (require.main === module) {
	runMigrations(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
		logger.error('Migration failed:', error);
		process.exit(1);
	});
}
