export const EmbedBuilderHelper = {
	moduleName: 'embed-builder',
	cacheKey(...parts: string[]): string {
		return ['embed-builder', ...parts].join(':');
	},
};
