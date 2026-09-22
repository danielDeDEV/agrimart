module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define('Favorite', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    listingId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'favorites',
    timestamps: true,
    indexes: [{ unique: true, fields: ['userId', 'listingId'] }],
  });

  return Favorite;
};
