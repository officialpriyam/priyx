import { DataTypes, Model, type Sequelize } from 'sequelize';

export class ModerationLog extends Model {
	public declare id: number;
	public declare guildId: string;
	public declare moderatorId: string;
	public declare targetId: string;
	public declare action: string;
	public declare reason: string | null;
	public declare createdAt: Date;
	public declare updatedAt: Date;

	public static initModel(sequelize: Sequelize): typeof ModerationLog {
		ModerationLog.init(
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
				moderatorId: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				targetId: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				action: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				reason: {
					type: DataTypes.TEXT,
					allowNull: true,
				},
			},
			{ sequelize, tableName: 'moderation_logs' },
		);
		return ModerationLog;
	}
}
