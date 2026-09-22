module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define('District', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    regionId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    capital: { type: DataTypes.STRING(100) },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'districts',
    timestamps: true,
    indexes: [{ fields: ['regionId'] }, { unique: true, fields: ['regionId', 'name'] }],
  });
  return District;
};
