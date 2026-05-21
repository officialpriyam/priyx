export const InviteHelper = {
	moduleName: 'invite',
	cacheKey(...parts: string[]): string {
		return ['invite', ...parts].join(':');
	},
};
