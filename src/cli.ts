import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { deployCommands } from './deploy';
import { runMigrations } from './migrate';

interface MakeOptions {
	name: string;
	addon: string;
}

function ensureDir(target: string): void {
	fs.mkdirSync(target, { recursive: true });
}

function writeIfMissing(target: string, content: string): void {
	if (fs.existsSync(target)) {
		throw new Error(`${target} already exists.`);
	}

	ensureDir(path.dirname(target));
	fs.writeFileSync(target, content, 'utf8');
}

function commandTemplate(name: string, addon: string): string {
	return `import { SlashCommandBuilder } from 'discord.js';
import { PriyxCommand } from '../../../src/structures/Command';
import { primaryEmbed } from '../../../src/utils/embed';

export default new PriyxCommand({
\tdata: new SlashCommandBuilder()
\t\t.setName('${name}')
\t\t.setDescription('${name} command for ${addon}.'),
\tcategory: '${addon}',
\taddon: '${addon}',
\tasync execute(interaction, client) {
\t\tawait interaction.reply({
\t\t\tembeds: [primaryEmbed('${name}', 'Module enabled: ' + String(client.module('${addon}' as never).enabled))],
\t\t});
\t},
});
`;
}

function eventTemplate(name: string, addon: string): string {
	return `import { PriyxEvent } from '../../../src/structures/Event';

export default new PriyxEvent({
\tname: '${name}' as never,
\taddon: '${addon}',
\tasync execute(client) {
\t\tclient.logger.debug('[${addon}] ${name} fired.');
\t},
});
`;
}

function migrationTemplate(): string {
	return `import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
\tasync up() {},
\tasync down() {},
});
`;
}

function modelTemplate(name: string): string {
	return `import { DataTypes, Model, type Sequelize } from 'sequelize';

export class ${name} extends Model {
\tpublic declare id: number;

\tpublic static initModel(sequelize: Sequelize): typeof ${name} {
\t\t${name}.init(
\t\t\t{
\t\t\t\tid: {
\t\t\t\t\ttype: DataTypes.INTEGER,
\t\t\t\t\tautoIncrement: true,
\t\t\t\t\tprimaryKey: true,
\t\t\t\t},
\t\t\t},
\t\t\t{ sequelize, tableName: '${name.toLowerCase()}s' },
\t\t);
\t\treturn ${name};
\t}
}
`;
}

const program = new Command();

program.name('priyx').description('Priyx Discord bot CLI');

program
	.command('make:command')
	.requiredOption('--name <name>')
	.requiredOption('--addon <addon>')
	.action((options: MakeOptions) => {
		writeIfMissing(
			path.resolve('addons', options.addon, 'commands', `${options.name}.ts`),
			commandTemplate(options.name, options.addon),
		);
	});

program
	.command('make:event')
	.requiredOption('--name <name>')
	.requiredOption('--addon <addon>')
	.action((options: MakeOptions) => {
		writeIfMissing(
			path.resolve('addons', options.addon, 'events', `${options.name}.ts`),
			eventTemplate(options.name, options.addon),
		);
	});

program
	.command('make:migration')
	.requiredOption('--name <name>')
	.requiredOption('--addon <addon>')
	.action((options: MakeOptions) => {
		writeIfMissing(
			path.resolve(
				'addons',
				options.addon,
				'database',
				'migrations',
				`${Date.now()}_${options.name}.ts`,
			),
			migrationTemplate(),
		);
	});

program
	.command('make:model')
	.requiredOption('--name <name>')
	.requiredOption('--addon <addon>')
	.action((options: MakeOptions) => {
		writeIfMissing(
			path.resolve(
				'addons',
				options.addon,
				'database',
				'models',
				`${options.name}.ts`,
			),
			modelTemplate(options.name),
		);
	});

program.command('migrate').action(() => runMigrations());
program
	.command('deploy')
	.option('--guild <guildId>')
	.option('--global')
	.option('--dry-run')
	.action((options: { guild?: string; global?: boolean; dryRun?: boolean }) =>
		deployCommands({
			dryRun: Boolean(options.dryRun),
			global: Boolean(options.global),
			guildId: options.global ? undefined : options.guild,
			remoteList: false,
		}),
	);

program.parseAsync(process.argv).catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
