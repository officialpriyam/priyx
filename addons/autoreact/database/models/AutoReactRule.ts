import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type Sequelize } from 'sequelize';

export type AutoReactMatchType = 'contains' | 'exact' | 'startsWith' | 'endsWith' | 'regex';

export class AutoReactRule extends Model<
	InferAttributes<AutoReactRule>,
	InferCreationAttributes<AutoReactRule>
> {
	public declare id: CreationOptional<number>;
	public declare guildId: string;
	public declare createdBy: string;
	public declare trigger: string;
	public declare matchType: AutoReactMatchType;
	public declare emoji: string;
	public declare chance: number;
	public declare enabled: CreationOptional<boolean>;
	public declare channelId: string | null;

	public static initModel(sequelize: Sequelize): typeof AutoReactRule {
		AutoReactRule.init(
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
				createdBy: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				trigger: {
					type: DataTypes.STRING(500),
					allowNull: false,
				},
				matchType: {
					type: DataTypes.STRING(32),
					allowNull: false,
					defaultValue: 'contains',
				},
				emoji: {
					type: DataTypes.STRING(128),
					allowNull: false,
				},
				chance: {
					type: DataTypes.FLOAT,
					allowNull: false,
					defaultValue: 1,
				},
				enabled: {
					type: DataTypes.BOOLEAN,
					allowNull: false,
					defaultValue: true,
				},
				channelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
			},
			{
				sequelize,
				tableName: 'auto_react_rules',
				indexes: [
					{ fields: ['guildId', 'enabled'] },
					{ fields: ['guildId', 'channelId'] },
				],
			},
		);
		return AutoReactRule;
	}
}
