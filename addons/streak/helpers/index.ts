export const StreakHelper = {
	moduleName: 'streak',
	cacheKey(...parts: string[]): string {
		return ['streak', ...parts].join(':');
	},
};
