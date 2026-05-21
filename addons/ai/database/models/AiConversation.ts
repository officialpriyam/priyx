import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from 'sequelize';

export interface AiStoredMessage {
	role: 'user' | 'assistant';
	content: string;
	at: number;
}

export class AiConversation extends Model<
	InferAttributes<AiConversation>,
	InferCreationAttributes<AiConversation>
> {
	public declare id: CreationOptional<number>;
	public declare guildId: string;
	public declare userId: string;
	public declare messages: CreationOptional<AiStoredMessage[]>;

	public static initModel(sequelize: Sequelize): typeof AiConversation {
		AiConversation.init(
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
				messages: {
					type: DataTypes.JSON,
					allowNull: false,
					defaultValue: [],
				},
			},
			{
				sequelize,
				tableName: 'ai_conversations',
				indexes: [{ unique: true, fields: ['guildId', 'userId'] }],
			},
		);
		return AiConversation;
	}
}
