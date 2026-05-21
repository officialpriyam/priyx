export const BirthdayHelper = {
	moduleName: 'birthday',
	cacheKey(...parts: string[]): string {
		return ['birthday', ...parts].join(':');
	},
};
