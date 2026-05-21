export const VerificationHelper = {
	moduleName: 'verification',
	cacheKey(...parts: string[]): string {
		return ['verification', ...parts].join(':');
	},
};
