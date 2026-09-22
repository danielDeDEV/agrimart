module.exports = (sequelize, DataTypes) => {
  const Offer = sequelize.define('Offer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(20), unique: true },
    listingId: { type: DataTypes.INTEGER, allowNull: false },
    buyerId: { type: DataTypes.INTEGER, allowNull: false },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    offerPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(30) },
    message: { type: DataTypes.TEXT },
    counterPrice: { type: DataTypes.DECIMAL(12, 2) },
    counterMessage: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired'),
      defaultValue: 'pending',
    },
    source: { type: DataTypes.ENUM('ussd', 'web', 'sms'), defaultValue: 'web' },
    expiresAt: { type: DataTypes.DATE },
    respondedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'offers',
    timestamps: true,
    indexes: [
      { fields: ['listingId'] }, { fields: ['buyerId'] },
      { fields: ['farmerId'] }, { fields: ['status'] },
    ],
  });

  return Offer;
};
