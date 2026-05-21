export const ReactionRoleHelper = {
	moduleName: 'reaction-role',
	cacheKey(...parts: string[]): string {
		return ['reaction-role', ...parts].join(':');
	},
};
