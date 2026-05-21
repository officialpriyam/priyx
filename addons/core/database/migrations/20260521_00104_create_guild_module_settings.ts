import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('guild_module_settings', {
			id: {
				type: Sequelize.DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			moduleName: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			enabled: {
				type: Sequelize.DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			config: {
				type: Sequelize.DataTypes.JSON,
				allowNull: false,
				defaultValue: {},
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

		await queryInterface.addIndex('guild_module_settings', ['guildId', 'moduleName'], {
			unique: true,
		});
	},
	async down(queryInterface) {
		await queryInterface.dropTable('guild_module_settings');
	},
});
