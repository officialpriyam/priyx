import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from 'sequelize';
import type { ModuleName, ModuleValue } from '../../../../src/types/modules';

export class GuildModuleSetting extends Model<
	InferAttributes<GuildModuleSetting>,
	InferCreationAttributes<GuildModuleSetting>
> {
	public declare id: CreationOptional<number>;
	public declare guildId: string;
	public declare moduleName: ModuleName;
	public declare enabled: CreationOptional<boolean>;
	public declare config: CreationOptional<Record<string, ModuleValue>>;

	public static initModel(sequelize: Sequelize): typeof GuildModuleSetting {
		GuildModuleSetting.init(
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
				moduleName: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				enabled: {
					type: DataTypes.BOOLEAN,
					allowNull: false,
					defaultValue: true,
				},
				config: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: {},
				},
			},
			{
				sequelize,
				tableName: 'guild_module_settings',
				indexes: [{ unique: true, fields: ['guildId', 'moduleName'] }],
			},
		);
		return GuildModuleSetting;
	}
}
