import { hexToDecimal } from '../../constants/colors';

export type ColorFormat = 'hex' | 'decimal' | 'discord';

export const discordColorHex: Record<string, string> = {
	Blurple: '#5865F2',
	Green: '#57F287',
	Yellow: '#FEE75C',
	Red: '#ED4245',
	White: '#FFFFFF',
	Black: '#23272A',
	Grey: '#99AAB5',
	Gray: '#99AAB5',
	DarkGrey: '#2F3136',
	DarkGray: '#2F3136',
};

function normalizeHex(value: string): string {
	const raw = value.trim().replace(/^#/, '');
	if (!/^[0-9a-f]{6}$/i.test(raw)) {
		throw new Error(`Invalid hex color: ${value}`);
	}

	return `#${raw.toUpperCase()}`;
}

export function convertColor(
	value: string | number,
	options: { from?: ColorFormat; to?: ColorFormat } = {},
): string | number {
	const from = options.from ?? (typeof value === 'number' ? 'decimal' : 'hex');
	const to = options.to ?? 'decimal';

	let hex: string;
	if (from === 'decimal') {
		const numeric = Number(value);
		if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffff) {
			throw new Error(`Invalid decimal color: ${String(value)}`);
		}
		hex = `#${numeric.toString(16).padStart(6, '0').toUpperCase()}`;
	} else if (from === 'discord') {
		const mapped = discordColorHex[String(value)];
		if (!mapped) {
			throw new Error(`Unknown Discord color: ${String(value)}`);
		}
		hex = mapped;
	} else {
		hex = normalizeHex(String(value));
	}

	if (to === 'hex') {
		return hex;
	}

	if (to === 'discord') {
		const found = Object.entries(discordColorHex).find(
			([, mapped]) => mapped.toUpperCase() === hex.toUpperCase(),
		);
		return found?.[0] ?? hex;
	}

	return hexToDecimal(hex);
}

export const colorHelpers = {
	convertColor,
	discordColorHex,
};
