export const EconomyHelper = {
	moduleName: 'economy',
	cacheKey(...parts: string[]): string {
		return ['economy', ...parts].join(':');
	},
};
