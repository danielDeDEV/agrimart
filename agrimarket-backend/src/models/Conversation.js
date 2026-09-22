module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    listingId: { type: DataTypes.INTEGER },
    orderId: { type: DataTypes.INTEGER },
    buyerId: { type: DataTypes.INTEGER, allowNull: false },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    lastMessage: { type: DataTypes.STRING(255) },
    lastMessageAt: { type: DataTypes.DATE },
    buyerUnread: { type: DataTypes.INTEGER, defaultValue: 0 },
    farmerUnread: { type: DataTypes.INTEGER, defaultValue: 0 },
    isArchived: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'conversations',
    timestamps: true,
    indexes: [{ fields: ['buyerId'] }, { fields: ['farmerId'] }, { fields: ['listingId'] }],
  });

  return Conversation;
};
