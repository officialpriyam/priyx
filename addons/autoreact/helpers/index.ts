export const AutoreactHelper = {
	moduleName: 'autoreact',
	cacheKey(...parts: string[]): string {
		return ['autoreact', ...parts].join(':');
	},
};
