module.exports = (sequelize, DataTypes) => {
  const Market = sequelize.define('Market', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), unique: true },
    regionId: { type: DataTypes.INTEGER, allowNull: false },
    districtId: { type: DataTypes.INTEGER },
    type: { type: DataTypes.ENUM('wholesale', 'retail', 'farmgate', 'export'), defaultValue: 'wholesale' },
    marketDays: { type: DataTypes.STRING(120), comment: 'e.g. Wednesday, Saturday' },
    description: { type: DataTypes.TEXT },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },
    imageUrl: { type: DataTypes.STRING(500) },
    isMajor: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'markets', timestamps: true, indexes: [{ fields: ['regionId'] }] });
  return Market;
};
