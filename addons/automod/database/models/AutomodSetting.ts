import {
	DataTypes,
	Model,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type Sequelize,
} from 'sequelize';

export const AUTOMOD_FEATURES = [
	'antiSpam',
	'antiDuplicate',
	'antiBadword',
	'antiInvites',
	'antiLinks',
	'antiMentions',
	'antiAllCaps',
	'antiEmojiSpam',
	'antiZalgo',
] as const;

export type AutomodFeature = (typeof AUTOMOD_FEATURES)[number];

export type AutomodFeatures = Record<AutomodFeature, boolean>;

export interface AutomodThresholds {
	spamMessages: number;
	spamWindowSeconds: number;
	duplicateMessages: number;
	duplicateWindowSeconds: number;
	shortMessages: number;
	mentionCount: number;
	allCapsMinLength: number;
	allCapsRatio: number;
	emojiMinTotal: number;
	emojiRatio: number;
	zalgoMarks: number;
}

export interface AutomodPunishment {
	timeoutSeconds: number;
	maxTimeoutSeconds: number;
}

export const defaultAutomodFeatures = (): AutomodFeatures => ({
	antiSpam: true,
	antiDuplicate: true,
	antiBadword: true,
	antiInvites: true,
	antiLinks: false,
	antiMentions: true,
	antiAllCaps: true,
	antiEmojiSpam: true,
	antiZalgo: true,
});

export const defaultAutomodThresholds = (): AutomodThresholds => ({
	spamMessages: 5,
	spamWindowSeconds: 40,
	duplicateMessages: 3,
	duplicateWindowSeconds: 900,
	shortMessages: 5,
	mentionCount: 5,
	allCapsMinLength: 15,
	allCapsRatio: 0.7,
	emojiMinTotal: 11,
	emojiRatio: 0.8,
	zalgoMarks: 8,
});

export const defaultAutomodPunishment = (): AutomodPunishment => ({
	timeoutSeconds: 180,
	maxTimeoutSeconds: 1800,
});

export class AutomodSetting extends Model<
	InferAttributes<AutomodSetting>,
	InferCreationAttributes<AutomodSetting>
> {
	public declare id: CreationOptional<number>;
	public declare guildId: string;
	public declare features: CreationOptional<AutomodFeatures>;
	public declare thresholds: CreationOptional<AutomodThresholds>;
	public declare punishment: CreationOptional<AutomodPunishment>;
	public declare badWords: CreationOptional<string[]>;
	public declare badwordWhitelist: CreationOptional<string[]>;
	public declare ignoredChannels: CreationOptional<string[]>;
	public declare whitelistUsers: CreationOptional<string[]>;
	public declare whitelistRoles: CreationOptional<string[]>;
	public declare allowedDomains: CreationOptional<string[]>;
	public declare logChannelId: CreationOptional<string | null>;
	public declare auditLogChannelId: CreationOptional<string | null>;

	public static initModel(sequelize: Sequelize): typeof AutomodSetting {
		AutomodSetting.init(
			{
				id: {
					type: DataTypes.INTEGER,
					autoIncrement: true,
					primaryKey: true,
				},
				guildId: {
					type: DataTypes.STRING,
					allowNull: false,
					unique: true,
				},
				features: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: defaultAutomodFeatures(),
				},
				thresholds: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: defaultAutomodThresholds(),
				},
				punishment: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: defaultAutomodPunishment(),
				},
				badWords: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				badwordWhitelist: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				ignoredChannels: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				whitelistUsers: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				whitelistRoles: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				allowedDomains: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
				logChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				auditLogChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
			},
			{
				sequelize,
				tableName: 'automod_settings',
				indexes: [{ unique: true, fields: ['guildId'] }],
			},
		);
		return AutomodSetting;
	}
}
