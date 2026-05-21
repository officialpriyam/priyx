import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('moderation_logs', {
			id: {
				type: Sequelize.DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			moderatorId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			targetId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			action: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			reason: {
				type: Sequelize.DataTypes.TEXT,
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

		await queryInterface.addIndex('moderation_logs', ['guildId', 'targetId']);
	},
	async down(queryInterface) {
		await queryInterface.dropTable('moderation_logs');
	},
});
