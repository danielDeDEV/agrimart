const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const Produce = sequelize.define('Produce', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    slug: { type: DataTypes.STRING(110), unique: true },
    localNames: { type: DataTypes.STRING(255), comment: 'Twi / Ewe / Ga / Dagbani names, comma separated' },
    scientificName: { type: DataTypes.STRING(120) },
    defaultUnit: { type: DataTypes.STRING(30), defaultValue: 'bag' },
    // Units this produce is traded in
    units: json('units', ['bag', 'kg']),
    description: { type: DataTypes.TEXT },
    imageUrl: { type: DataTypes.STRING(500) },
    seasonStart: { type: DataTypes.INTEGER, comment: 'Month 1-12 harvest window opens' },
    seasonEnd: { type: DataTypes.INTEGER },
    shelfLifeDays: { type: DataTypes.INTEGER },
    isPerishable: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    ussdIndex: { type: DataTypes.INTEGER, comment: 'Stable position in the USSD produce menu' },
  }, { tableName: 'produces', timestamps: true, indexes: [{ fields: ['categoryId'] }] });
  return Produce;
};
