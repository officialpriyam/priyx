export const FunHelper = {
	moduleName: 'fun',
	cacheKey(...parts: string[]): string {
		return ['fun', ...parts].join(':');
	},
};
