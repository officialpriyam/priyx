export const AdventureHelper = {
	moduleName: 'adventure',
	cacheKey(...parts: string[]): string {
		return ['adventure', ...parts].join(':');
	},
};
