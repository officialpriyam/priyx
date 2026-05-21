export const CoreHelper = {
	moduleName: 'core',
	cacheKey(...parts: string[]): string {
		return ['core', ...parts].join(':');
	},
};
