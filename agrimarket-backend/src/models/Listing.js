const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const Listing = sequelize.define('Listing', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: {
      type: DataTypes.STRING(20), allowNull: false, unique: true,
      comment: 'Short code farmers quote over SMS, e.g. LST-4K9P2A',
    },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    produceId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER },

    title: { type: DataTypes.STRING(160) },
    description: { type: DataTypes.TEXT },
    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantityRemaining: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'bag' },
    pricePerUnit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    totalValue: { type: DataTypes.DECIMAL(14, 2) },
    currency: { type: DataTypes.STRING(5), defaultValue: 'GHS' },
    minOrderQuantity: { type: DataTypes.DECIMAL(12, 2), defaultValue: 1 },
    negotiable: { type: DataTypes.BOOLEAN, defaultValue: true },

    qualityGrade: { type: DataTypes.ENUM('A', 'B', 'C'), defaultValue: 'A' },
    isOrganic: { type: DataTypes.BOOLEAN, defaultValue: false },
    harvestDate: { type: DataTypes.DATEONLY },
    availableFrom: { type: DataTypes.DATEONLY },
    expiresAt: { type: DataTypes.DATE },

    regionId: { type: DataTypes.INTEGER },
    districtId: { type: DataTypes.INTEGER },
    location: { type: DataTypes.STRING(180) },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },

    // Only the farmer's own uploads. Catalogue photos are never copied here.
    images: json('images', []),
    /**
     * The picture buyers see first: the farmer's first photo, otherwise the
     * produce's catalogue photo (USSD and SMS listings have no photos of their
     * own). Needs the `produce` association loaded to use the fallback.
     */
    coverImage: {
      type: DataTypes.VIRTUAL,
      get() {
        const own = this.get('images');
        if (Array.isArray(own) && own.length) return own[0];
        return this.produce?.imageUrl || null;
      },
    },
    /** 'farmer' | 'catalogue' | 'none' — lets the website label stock photos honestly. */
    photoSource: {
      type: DataTypes.VIRTUAL,
      get() {
        const own = this.get('images');
        if (Array.isArray(own) && own.length) return 'farmer';
        return this.produce?.imageUrl ? 'catalogue' : 'none';
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'reserved', 'sold', 'expired', 'rejected', 'withdrawn'),
      defaultValue: 'active',
    },
    source: { type: DataTypes.ENUM('ussd', 'web', 'sms', 'agent'), defaultValue: 'web' },

    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    inquiries: { type: DataTypes.INTEGER, defaultValue: 0 },
    offerCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
    isUrgent: { type: DataTypes.BOOLEAN, defaultValue: false },

    moderatedBy: { type: DataTypes.INTEGER },
    moderatedAt: { type: DataTypes.DATE },
    rejectionReason: { type: DataTypes.STRING(255) },
    soldAt: { type: DataTypes.DATE },
  }, {
    tableName: 'listings',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['farmerId'] }, { fields: ['produceId'] }, { fields: ['status'] },
      { fields: ['regionId'] }, { fields: ['source'] }, { fields: ['createdAt'] },
    ],
    hooks: {
      beforeValidate: (listing) => {
        if (listing.quantityRemaining === undefined || listing.quantityRemaining === null) {
          listing.quantityRemaining = listing.quantity;
        }
      },
      beforeSave: (listing) => {
        listing.totalValue = Number(listing.quantity || 0) * Number(listing.pricePerUnit || 0);
        if (Number(listing.quantityRemaining) <= 0 && listing.status === 'active') {
          listing.status = 'sold';
          listing.soldAt = new Date();
        }
      },
    },
  });

  return Listing;
};
