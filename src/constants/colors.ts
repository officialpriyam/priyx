import { getModule } from '../modules';

export function hexToDecimal(hex: string): number {
	const normalized = hex.replace('#', '').trim();
	const value = Number.parseInt(normalized, 16);
	return Number.isFinite(value) ? value : 0x6c63ff;
}

export const colors = {
	get primary() {
		return hexToDecimal(getModule('colors').primary);
	},
	get success() {
		return hexToDecimal(getModule('colors').success);
	},
	get warning() {
		return hexToDecimal(getModule('colors').warning);
	},
	get error() {
		return hexToDecimal(getModule('colors').error);
	},
	get info() {
		return hexToDecimal(getModule('colors').info);
	},
	get economy() {
		return hexToDecimal(getModule('colors').economy);
	},
	get xp() {
		return hexToDecimal(getModule('colors').xp);
	},
	get music() {
		return hexToDecimal(getModule('colors').music);
	},
};
