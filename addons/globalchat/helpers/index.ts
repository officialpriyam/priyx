export const GlobalchatHelper = {
	moduleName: 'globalchat',
	cacheKey(...parts: string[]): string {
		return ['globalchat', ...parts].join(':');
	},
};
