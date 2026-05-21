import { DataTypes, Model, type Sequelize } from 'sequelize';

export class StreakProfile extends Model {
	public declare id: number;
	public declare guildId: string;
	public declare userId: string | null;
	public declare data: Record<string, unknown>;

	public static initModel(sequelize: Sequelize): typeof StreakProfile {
		StreakProfile.init(
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
			{ sequelize, tableName: 'streak_profiles' },
		);
		return StreakProfile;
	}
}
