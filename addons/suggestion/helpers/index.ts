export const SuggestionHelper = {
	moduleName: 'suggestion',
	cacheKey(...parts: string[]): string {
		return ['suggestion', ...parts].join(':');
	},
};
