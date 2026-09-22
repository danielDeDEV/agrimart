module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    slug: { type: DataTypes.STRING(90), unique: true },
    description: { type: DataTypes.TEXT },
    icon: { type: DataTypes.STRING(60), defaultValue: 'Wheat', comment: 'lucide-react icon name' },
    color: { type: DataTypes.STRING(20), defaultValue: '#16a34a' },
    imageUrl: { type: DataTypes.STRING(500) },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'categories', timestamps: true });
  return Category;
};
