export * from './color';
export * from './discord';

import { colorHelpers } from './color';
import { discordHelpers } from './discord';

export const helpers = {
	color: colorHelpers,
	discord: discordHelpers,
};
