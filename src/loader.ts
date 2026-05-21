import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PriyxCommand } from './structures/Command';
import { PriyxEvent } from './structures/Event';
import { PriyxAddon } from './structures/Addon';
import { scheduleTask } from './scheduler';
import { moduleNames, type ModuleName } from './types/modules';
import { addonLogger, ensureAddonLog } from './logger';
import type { PriyxClient } from './client';
import type {
	PriyxButtonHandler,
	PriyxModalHandler,
	PriyxSelectMenuHandler,
	PriyxTask,
} from './types/addon';

interface LoadedModule {
	default?: unknown;
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

function objectWith(
	value: unknown,
	key: string,
): Record<string, unknown> | null {
	if (typeof value !== 'object' || value === null || !(key in value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

function guildIdFromArgs(args: unknown[]): string | null {
	for (const arg of args) {
		const directGuildId = objectWith(arg, 'guildId')?.guildId;
		if (typeof directGuildId === 'string') {
			return directGuildId;
		}

		const guild = objectWith(arg, 'guild')?.guild;
		const guildId = objectWith(guild, 'id')?.id;
		if (typeof guildId === 'string') {
			return guildId;
		}
	}

	return null;
}

async function executeEvent(
	client: PriyxClient,
	event: PriyxEvent,
	args: unknown[],
): Promise<void> {
	const guildId = guildIdFromArgs(args);
	if (
		guildId &&
		event.addon !== 'core' &&
		isConfiguredModule(event.addon) &&
		!(await client.isGuildModuleEnabled(guildId, event.addon))
	) {
		return;
	}

	await (
		event.execute as (client: PriyxClient, ...args: unknown[]) => Promise<void>
	)(client, ...args);
}

function isTask(value: unknown): value is PriyxTask {
	return (
		typeof value === 'object' &&
		value !== null &&
		'name' in value &&
		'addon' in value &&
		'schedule' in value &&
		'execute' in value
	);
}

function isComponentHandler(
	value: unknown,
): value is PriyxButtonHandler | PriyxSelectMenuHandler | PriyxModalHandler {
	return (
		typeof value === 'object' &&
		value !== null &&
		'customId' in value &&
		'addon' in value &&
		'execute' in value
	);
}

export async function loadAddons(client: PriyxClient): Promise<void> {
	const root = addonsRoot();
	const ext = runtimeExtension();

	if (!(await exists(root))) {
		client.logger.warn(`Addon root not found: ${root}`);
		return;
	}

	const addonEntries = await fs.readdir(root, { withFileTypes: true });

	for (const addonEntry of addonEntries) {
		if (!addonEntry.isDirectory()) {
			continue;
		}

		const addonName = addonEntry.name;
		if (!isConfiguredModule(addonName)) {
			continue;
		}

		const addonPath = path.join(root, addonName);
		const registerFile = path.join(addonPath, `register${ext}`);
		ensureAddonLog(addonName);
		const log = addonLogger(addonName);

		if (await exists(registerFile)) {
			const addon = await importDefault(registerFile);
			if (addon instanceof PriyxAddon) {
				await addon.setup(client);
				log.info('Addon setup completed.');
			}
		}

		for (const file of await collectFiles(
			path.join(addonPath, 'commands'),
			ext,
		)) {
			const command = await importDefault(file);
			if (!(command instanceof PriyxCommand)) {
				log.warn(`Skipped invalid command export: ${file}`);
				continue;
			}

			if (client.commands.has(command.data.name)) {
				log.warn(`Skipped duplicate command ${command.data.name} from ${file}`);
				continue;
			}

			client.commands.set(command.data.name, command);
		}

		for (const file of await collectFiles(
			path.join(addonPath, 'events'),
			ext,
		)) {
			const event = await importDefault(file);
			if (!(event instanceof PriyxEvent)) {
				log.warn(`Skipped invalid event export: ${file}`);
				continue;
			}

			if (event.once) {
				client.once(event.name, (...args) => executeEvent(client, event, args));
			} else {
				client.on(event.name, (...args) => executeEvent(client, event, args));
			}
		}

		for (const file of await collectFiles(path.join(addonPath, 'tasks'), ext)) {
			const task = await importDefault(file);
			if (!isTask(task)) {
				log.warn(`Skipped invalid task export: ${file}`);
				continue;
			}

			scheduleTask(client, task);
		}

		for (const file of await collectFiles(
			path.join(addonPath, 'buttons'),
			ext,
		)) {
			const handler = await importDefault(file);
			if (!isComponentHandler(handler)) {
				log.warn(`Skipped invalid button handler export: ${file}`);
				continue;
			}

			client.buttons.set(handler.customId, handler as PriyxButtonHandler);
		}

		for (const file of await collectFiles(
			path.join(addonPath, 'select_menus'),
			ext,
		)) {
			const handler = await importDefault(file);
			if (!isComponentHandler(handler)) {
				log.warn(`Skipped invalid select menu handler export: ${file}`);
				continue;
			}

			client.selectMenus.set(
				handler.customId,
				handler as PriyxSelectMenuHandler,
			);
		}

		for (const file of await collectFiles(
			path.join(addonPath, 'modals'),
			ext,
		)) {
			const handler = await importDefault(file);
			if (!isComponentHandler(handler)) {
				log.warn(`Skipped invalid modal handler export: ${file}`);
				continue;
			}

			client.modals.set(handler.customId, handler as PriyxModalHandler);
		}

		log.info(`Loaded addon ${addonName}`);
	}
}
