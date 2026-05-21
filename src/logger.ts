import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';

const logsDir = path.resolve(process.cwd(), 'logs');
const addonLogsDir = path.join(logsDir, 'addons');
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(addonLogsDir, { recursive: true });

const addonTransports = new Map<string, winston.transport>();

const ansi = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
} as const;

function safeLogName(value: string): string {
	return value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

function levelColor(level: string): string {
	switch (level) {
		case 'error':
			return ansi.red;
		case 'warn':
			return ansi.yellow;
		case 'info':
			return ansi.cyan;
		case 'debug':
			return ansi.magenta;
		default:
			return ansi.blue;
	}
}

function fileFormat() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.printf(({ timestamp, level, message, stack, addon }) => {
			const prefix = addon ? `[${addon}] ` : '';
			const text = stack ? `${message}\n${stack}` : String(message);
			return `[${timestamp}] ${level.toUpperCase()}: ${prefix}${text}`;
		}),
	);
}

function consoleFormat() {
	return winston.format.combine(
		winston.format.timestamp({ format: 'HH:mm:ss' }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.printf(({ timestamp, level, message, stack, addon }) => {
			const color = levelColor(String(level));
			const addonPrefix = addon
				? ` ${ansi.magenta}[${String(addon)}]${ansi.reset}`
				: '';
			const text = stack ? `${message}\n${stack}` : String(message);
			return `${ansi.gray}${timestamp}${ansi.reset} ${color}${String(level).toUpperCase().padEnd(5)}${ansi.reset}${addonPrefix} ${color}${text}${ansi.reset}`;
		}),
	);
}

export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL ?? 'info',
	transports: [
		new winston.transports.Console({
			format: consoleFormat(),
		}),
		new winston.transports.File({
			filename: path.join(logsDir, 'bot.log'),
			format: fileFormat(),
		}),
		new winston.transports.File({
			filename: path.join(logsDir, 'error.log'),
			level: 'error',
			format: fileFormat(),
		}),
		new winston.transports.File({
			filename: path.join(logsDir, 'combined.log'),
			format: fileFormat(),
		}),
	],
});

export function ensureAddonLog(addon: string): void {
	if (addonTransports.has(addon)) {
		return;
	}

	const transport = new winston.transports.File({
		filename: path.join(addonLogsDir, `${safeLogName(addon)}.log`),
		format: winston.format.combine(
			winston.format((info) => {
				if (info.addon === addon || info.label === addon) {
					return info;
				}

				return false;
			})(),
			fileFormat(),
		),
	});
	addonTransports.set(addon, transport);
	logger.add(transport);
}

export function addonLogger(addon: string): winston.Logger {
	ensureAddonLog(addon);
	return logger.child({ addon });
}
