export const TempvoiceHelper = {
	moduleName: 'tempvoice',
	cacheKey(...parts: string[]): string {
		return ['tempvoice', ...parts].join(':');
	},
};
