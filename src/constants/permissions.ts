import { PermissionFlagsBits } from 'discord.js';

export const moderationPermissions = {
	ban: PermissionFlagsBits.BanMembers,
	kick: PermissionFlagsBits.KickMembers,
	mute: PermissionFlagsBits.ModerateMembers,
	clear: PermissionFlagsBits.ManageMessages,
	channel: PermissionFlagsBits.ManageChannels,
	role: PermissionFlagsBits.ManageRoles,
};
