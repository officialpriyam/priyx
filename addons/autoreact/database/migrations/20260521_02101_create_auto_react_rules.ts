import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('auto_react_rules', {
			id: {
				type: Sequelize.DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			createdBy: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			trigger: {
				type: Sequelize.DataTypes.STRING(500),
				allowNull: false,
			},
			matchType: {
				type: Sequelize.DataTypes.STRING(32),
				allowNull: false,
				defaultValue: 'contains',
			},
			emoji: {
				type: Sequelize.DataTypes.STRING(128),
				allowNull: false,
			},
			chance: {
				type: Sequelize.DataTypes.FLOAT,
				allowNull: false,
				defaultValue: 1,
			},
			enabled: {
				type: Sequelize.DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			channelId: {
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

		await queryInterface.addIndex('auto_react_rules', ['guildId', 'enabled']);
		await queryInterface.addIndex('auto_react_rules', ['guildId', 'channelId']);
	},
	async down(queryInterface) {
		await queryInterface.dropTable('auto_react_rules');
	},
});
