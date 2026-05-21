import { PriyxMigration } from '../../../../src/structures/Migration';

export default new PriyxMigration({
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('reaction_role_panels', {
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
				allowNull: true,
			},
			data: {
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
	},
	async down(queryInterface) {
		await queryInterface.dropTable('reaction_role_panels');
	},
});
