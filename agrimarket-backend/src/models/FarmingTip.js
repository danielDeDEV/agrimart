module.exports = (sequelize, DataTypes) => {
  const FarmingTip = sequelize.define('FarmingTip', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(180), allowNull: false },
    slug: { type: DataTypes.STRING(200), unique: true },
    excerpt: { type: DataTypes.STRING(300) },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    smsVersion: {
      type: DataTypes.STRING(320),
      comment: 'Condensed copy pushed to feature phones — keep under 2 SMS pages',
    },
    category: {
      type: DataTypes.ENUM('planting', 'pest_control', 'harvesting', 'storage', 'marketing', 'finance', 'weather', 'livestock'),
      defaultValue: 'planting',
    },
    produceId: { type: DataTypes.INTEGER },
    regionId: { type: DataTypes.INTEGER, comment: 'Null means nationwide' },
    imageUrl: { type: DataTypes.STRING(500) },
    author: { type: DataTypes.STRING(120), defaultValue: 'AgriMart Extension Desk' },
    readMinutes: { type: DataTypes.INTEGER, defaultValue: 3 },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
    publishedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    createdBy: { type: DataTypes.INTEGER },
  }, {
    tableName: 'farming_tips',
    timestamps: true,
    indexes: [{ fields: ['category'] }, { fields: ['isPublished'] }, { fields: ['publishedAt'] }],
  });

  return FarmingTip;
};
