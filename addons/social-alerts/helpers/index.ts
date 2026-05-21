export const SocialAlertsHelper = {
	moduleName: 'social-alerts',
	cacheKey(...parts: string[]): string {
		return ['social-alerts', ...parts].join(':');
	},
};
