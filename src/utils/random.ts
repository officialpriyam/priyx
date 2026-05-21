export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(items: readonly T[]): T {
	if (items.length === 0) {
		throw new Error('Cannot pick from an empty array.');
	}

	return items[randomInt(0, items.length - 1)];
}
