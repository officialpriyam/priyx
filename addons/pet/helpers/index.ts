export const PetHelper = {
	moduleName: 'pet',
	cacheKey(...parts: string[]): string {
		return ['pet', ...parts].join(':');
	},
};
