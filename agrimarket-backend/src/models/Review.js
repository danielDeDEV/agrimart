module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    reviewerId: { type: DataTypes.INTEGER, allowNull: false },
    revieweeId: { type: DataTypes.INTEGER, allowNull: false },
    reviewerRole: { type: DataTypes.ENUM('farmer', 'buyer'), allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    qualityRating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
    communicationRating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
    punctualityRating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
    comment: { type: DataTypes.TEXT },
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
    isFlagged: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'reviews',
    timestamps: true,
    indexes: [
      { fields: ['revieweeId'] }, { fields: ['reviewerId'] },
      { unique: true, fields: ['orderId', 'reviewerId'] },
    ],
  });

  return Review;
};
