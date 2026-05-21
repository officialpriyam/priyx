export function seconds(ms: number): number {
	return Math.floor(ms / 1000);
}

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secondsLeft = totalSeconds % 60;
	return `${hours}h ${minutes}m ${secondsLeft}s`;
}
