export const GiveawayHelper = {
	moduleName: 'giveaway',
	cacheKey(...parts: string[]): string {
		return ['giveaway', ...parts].join(':');
	},
};
