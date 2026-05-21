import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('warnings', {
			id: {
				type: Sequelize.DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			userId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			moderatorId: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			reason: {
				type: Sequelize.DataTypes.TEXT,
				allowNull: false,
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

		await queryInterface.addIndex('warnings', ['guildId', 'userId']);
	},
	async down(queryInterface) {
		await queryInterface.dropTable('warnings');
	},
});
