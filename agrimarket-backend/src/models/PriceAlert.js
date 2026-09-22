module.exports = (sequelize, DataTypes) => {
  const PriceAlert = sequelize.define('PriceAlert', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    produceId: { type: DataTypes.INTEGER, allowNull: false },
    marketId: { type: DataTypes.INTEGER, comment: 'Null means any market' },
    regionId: { type: DataTypes.INTEGER },
    targetPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(30), defaultValue: 'bag' },
    direction: { type: DataTypes.ENUM('above', 'below'), defaultValue: 'above' },
    channel: { type: DataTypes.ENUM('sms', 'in_app', 'both'), defaultValue: 'both' },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastTriggeredAt: { type: DataTypes.DATE },
    triggerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    source: { type: DataTypes.ENUM('ussd', 'web', 'sms'), defaultValue: 'web' },
  }, {
    tableName: 'price_alerts',
    timestamps: true,
    indexes: [{ fields: ['userId'] }, { fields: ['produceId'] }, { fields: ['isActive'] }],
  });

  return PriceAlert;
};
