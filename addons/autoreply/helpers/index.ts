export const AutoreplyHelper = {
	moduleName: 'autoreply',
	cacheKey(...parts: string[]): string {
		return ['autoreply', ...parts].join(':');
	},
};
