import { DataTypes, Model, type Sequelize } from 'sequelize';

export class AutomodCase extends Model {
	public declare id: number;
	public declare guildId: string;
	public declare userId: string | null;
	public declare data: Record<string, unknown>;

	public static initModel(sequelize: Sequelize): typeof AutomodCase {
		AutomodCase.init(
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
					allowNull: true,
				},
				data: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: {},
				},
			},
			{ sequelize, tableName: 'automod_cases' },
		);
		return AutomodCase;
	}
}
