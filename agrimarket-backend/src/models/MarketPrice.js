module.exports = (sequelize, DataTypes) => {
  const MarketPrice = sequelize.define('MarketPrice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    produceId: { type: DataTypes.INTEGER, allowNull: false },
    marketId: { type: DataTypes.INTEGER, allowNull: false },
    regionId: { type: DataTypes.INTEGER },

    unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'bag' },
    minPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    maxPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    avgPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    previousAvgPrice: { type: DataTypes.DECIMAL(12, 2) },
    changePercent: {
      type: DataTypes.DECIMAL(6, 2), defaultValue: 0,
      comment: 'Movement against the previous record for the same produce/market/unit',
    },
    trend: { type: DataTypes.ENUM('up', 'down', 'stable'), defaultValue: 'stable' },
    priceType: { type: DataTypes.ENUM('wholesale', 'retail', 'farmgate'), defaultValue: 'wholesale' },
    currency: { type: DataTypes.STRING(5), defaultValue: 'GHS' },

    priceDate: { type: DataTypes.DATEONLY, allowNull: false },
    source: {
      type: DataTypes.ENUM('esoko', 'moFA', 'agent', 'admin', 'farmer', 'survey', 'system'),
      defaultValue: 'admin',
      comment: 'Provenance matters — farmers trust verified MoFA/agent data more',
    },
    notes: { type: DataTypes.STRING(255) },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
    recordedBy: { type: DataTypes.INTEGER },
  }, {
    tableName: 'market_prices',
    timestamps: true,
    indexes: [
      { fields: ['produceId'] }, { fields: ['marketId'] }, { fields: ['priceDate'] },
      { fields: ['produceId', 'marketId', 'priceDate'] },
    ],
    hooks: {
      beforeSave: (price) => {
        const prev = Number(price.previousAvgPrice || 0);
        const curr = Number(price.avgPrice || 0);
        if (prev > 0) {
          const change = ((curr - prev) / prev) * 100;
          price.changePercent = Number(change.toFixed(2));
          price.trend = change > 1 ? 'up' : change < -1 ? 'down' : 'stable';
        }
      },
    },
  });

  return MarketPrice;
};
