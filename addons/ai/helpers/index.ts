export const AiHelper = {
	moduleName: 'ai',
	cacheKey(...parts: string[]): string {
		return ['ai', ...parts].join(':');
	},
};
