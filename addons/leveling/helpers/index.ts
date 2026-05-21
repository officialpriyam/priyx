export const LevelingHelper = {
	moduleName: 'leveling',
	cacheKey(...parts: string[]): string {
		return ['leveling', ...parts].join(':');
	},
};
