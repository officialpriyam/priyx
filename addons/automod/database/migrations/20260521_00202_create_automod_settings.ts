import { PriyxMigration } from '../../../../src/structures/Migration';

const defaultFeatures = {
	antiSpam: true,
	antiDuplicate: true,
	antiBadword: true,
	antiInvites: true,
	antiLinks: false,
	antiMentions: true,
	antiAllCaps: true,
	antiEmojiSpam: true,
	antiZalgo: true,
};

const defaultThresholds = {
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
};

const defaultPunishment = {
	timeoutSeconds: 180,
	maxTimeoutSeconds: 1800,
};

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('automod_settings', {
			id: {
				type: Sequelize.DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			features: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: defaultFeatures,
			},
			thresholds: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: defaultThresholds,
			},
			punishment: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: defaultPunishment,
			},
			badWords: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			badwordWhitelist: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			ignoredChannels: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			whitelistUsers: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			whitelistRoles: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			allowedDomains: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			logChannelId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: true,
			},
			auditLogChannelId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: true,
			},
			createdAt: {
				type: Sequelize.DataTypes.DATE,
				allowNull: false,
				defaultValue: Sequelize.DataTypes.NOW,
			},
			updatedAt: {
				type: Sequelize.DataTypes.DATE,
				allowNull: false,
				defaultValue: Sequelize.DataTypes.NOW,
			},
		});

		await queryInterface.addIndex('automod_settings', ['guildId'], {
			unique: true,
			name: 'automod_settings_guild_id_unique',
		});
		await queryInterface.addIndex('automod_cases', ['guildId'], {
			name: 'automod_cases_guild_id',
		});
		await queryInterface.addIndex('automod_cases', ['guildId', 'userId'], {
			name: 'automod_cases_guild_user',
		});
	},
	async down(queryInterface) {
		await queryInterface.dropTable('automod_settings');
	},
});
