import { DataTypes, Model, type Sequelize } from 'sequelize';

export class GuildSettings extends Model {
	public declare id: number;
	public declare guildId: string;
	public declare settings: Record<string, unknown>;

	public static initModel(sequelize: Sequelize): typeof GuildSettings {
		GuildSettings.init(
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
				settings: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: {},
				},
			},
			{ sequelize, tableName: 'guild_settings' },
		);
		return GuildSettings;
	}
}
