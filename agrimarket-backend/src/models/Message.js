module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversationId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    attachmentUrl: { type: DataTypes.STRING(500) },
    channel: {
      type: DataTypes.ENUM('web', 'sms'), defaultValue: 'web',
      comment: 'Farmers on feature phones receive these as SMS and reply by SMS',
    },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    readAt: { type: DataTypes.DATE },
    mirroredToSms: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'messages',
    timestamps: true,
    indexes: [{ fields: ['conversationId'] }, { fields: ['senderId'] }, { fields: ['createdAt'] }],
  });

  return Message;
};
