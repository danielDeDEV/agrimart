module.exports = (sequelize, DataTypes) => {
  const Region = sequelize.define('Region', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    capital: { type: DataTypes.STRING(80) },
    zone: { type: DataTypes.ENUM('Coastal', 'Forest', 'Transitional', 'Savannah'), defaultValue: 'Forest' },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },
    farmerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'regions', timestamps: true });
  return Region;
};
