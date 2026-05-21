import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import { logger } from './logger';
import { PriyxCommand } from './structures/Command';
import { moduleNames, type ModuleName } from './types/modules';

interface LoadedModule {
	default?: unknown;
}

interface DeployOptions {
	dryRun: boolean;
	global: boolean;
	guildId?: string;
	remoteList: boolean;
}

interface RemoteCommand {
	id?: string;
	name?: string;
}

function runtimeExtension(): '.ts' | '.js' {
	return path.extname(__filename) === '.ts' ? '.ts' : '.js';
}

function addonsRoot(): string {
	return path.resolve(
		process.cwd(),
		runtimeExtension() === '.ts' ? 'addons' : path.join('dist', 'addons'),
	);
}

async function exists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function collectFiles(root: string, ext: string): Promise<string[]> {
	if (!(await exists(root))) {
		return [];
	}

	const entries = await fs.readdir(root, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(root, entry.name);
			if (entry.isDirectory()) {
				return collectFiles(fullPath, ext);
			}

			return entry.isFile() && entry.name.endsWith(ext) ? [fullPath] : [];
		}),
	);

	return files.flat();
}

async function importDefault(file: string): Promise<unknown> {
	const imported = (await import(pathToFileURL(file).href)) as LoadedModule;
	return imported.default ?? imported;
}

function isConfiguredModule(name: string): name is ModuleName {
	return (moduleNames as readonly string[]).includes(name);
}

export async function collectDeployCommands(): Promise<PriyxCommand[]> {
	const root = addonsRoot();
	const ext = runtimeExtension();
	const commands = new Map<string, PriyxCommand>();

	if (!(await exists(root))) {
		throw new Error(`Addon root not found: ${root}`);
	}

	const addonEntries = await fs.readdir(root, { withFileTypes: true });
	for (const addonEntry of addonEntries) {
		if (!addonEntry.isDirectory() || !isConfiguredModule(addonEntry.name)) {
			continue;
		}

		const commandFiles = await collectFiles(
			path.join(root, addonEntry.name, 'commands'),
			ext,
		);
		for (const file of commandFiles) {
			const command = await importDefault(file);
			if (!(command instanceof PriyxCommand)) {
				logger.warn(`Skipped invalid command export: ${file}`);
				continue;
			}

			if (commands.has(command.data.name)) {
				logger.warn(
					`Skipped duplicate command ${command.data.name} from ${file}`,
				);
				continue;
			}

			commands.set(command.data.name, command);
		}
	}

	return [...commands.values()].sort((left, right) =>
		left.data.name.localeCompare(right.data.name),
	);
}

function parseArgs(args: string[]): DeployOptions {
	const options: DeployOptions = {
		dryRun: false,
		global: false,
		guildId: undefined,
		remoteList: false,
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--dry-run' || arg === '--list') {
			options.dryRun = true;
			continue;
		}

		if (arg === '--remote-list' || arg === '--fetch') {
			options.remoteList = true;
			continue;
		}

		if (arg === '--global') {
			options.global = true;
			options.guildId = undefined;
			continue;
		}

		if (arg === '--guild') {
			options.guildId = args[index + 1];
			options.global = false;
			index += 1;
			continue;
		}

		if (arg.startsWith('--guild=')) {
			options.guildId = arg.slice('--guild='.length);
			options.global = false;
		}
	}

	return options;
}

function remoteNames(commands: unknown): string {
	if (!Array.isArray(commands)) {
		return 'unknown response';
	}

	return commands
		.map((command: RemoteCommand) => command.name)
		.filter((name): name is string => typeof name === 'string')
		.sort((left, right) => left.localeCompare(right))
		.map((name) => `/${name}`)
		.join(', ');
}

export async function deployCommands(options: DeployOptions): Promise<void> {
	const token = process.env.DISCORD_TOKEN;
	const clientId = process.env.CLIENT_ID;
	const commands = await collectDeployCommands();
	const body = commands.map((command) => command.data.toJSON());
	const names = commands.map((command) => `/${command.data.name}`).join(', ');

	if (options.dryRun) {
		logger.info(
			`Deploy dry-run ${options.guildId ? `for guild ${options.guildId}` : 'globally'}: ${commands.length} command(s): ${names}`,
		);
		return;
	}

	if (!options.global && !options.guildId) {
		throw new Error(
			'No guild selected for immediate deploy. Run "npm run deploy -- --guild YOUR_GUILD_ID" or "npm run deploy:global" for delayed global commands.',
		);
	}

	if (!token || !clientId) {
		throw new Error(
			'DISCORD_TOKEN and CLIENT_ID are required to deploy commands.',
		);
	}

	const rest = new REST({ version: '10' }).setToken(token);
	const route = options.guildId
		? Routes.applicationGuildCommands(clientId, options.guildId)
		: Routes.applicationCommands(clientId);

	if (options.remoteList) {
		const remote = await rest.get(route);
		logger.info(
			`Discord currently has ${Array.isArray(remote) ? remote.length : 'unknown'} ${options.guildId ? `guild ${options.guildId}` : 'global'} command(s): ${remoteNames(remote)}`,
		);
		return;
	}

	const deployed = await rest.put(route, { body });
	logger.info(
		`Discord accepted ${Array.isArray(deployed) ? deployed.length : commands.length} command(s) ${options.guildId ? `for guild ${options.guildId}` : 'globally'}. Commands: ${remoteNames(deployed) || names}`,
	);

	if (!options.guildId) {
		logger.warn(
			'Global command deploys are cached by Discord and may take time to appear in every server. Use "npm run deploy -- --guild YOUR_SERVER_ID" for immediate testing.',
		);
	}
}

if (require.main === module) {
	deployCommands(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
		logger.error('Failed to deploy commands:', error);
		process.exit(1);
	});
}
