export const ImageHelper = {
	moduleName: 'image',
	cacheKey(...parts: string[]): string {
		return ['image', ...parts].join(':');
	},
};
