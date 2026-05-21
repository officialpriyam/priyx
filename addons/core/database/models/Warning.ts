import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Warning extends Model {
	public declare id: number;
	public declare guildId: string;
	public declare userId: string;
	public declare moderatorId: string;
	public declare reason: string;
	public declare createdAt: Date;
	public declare updatedAt: Date;

	public static initModel(sequelize: Sequelize): typeof Warning {
		Warning.init(
			{
				id: {
					type: DataTypes.INTEGER,
					autoIncrement: true,
					primaryKey: true,
				},
				guildId: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				userId: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				moderatorId: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				reason: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
			},
			{ sequelize, tableName: 'warnings' },
		);
		return Warning;
	}
}
