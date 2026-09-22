const { json } = require('../utils/jsonType');

const bcrypt = require('bcryptjs');
const env = require('../config/env');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, unique: true },
    fullName: { type: DataTypes.STRING(120), allowNull: false },
    phone: {
      type: DataTypes.STRING(15), allowNull: false, unique: true,
      comment: 'Stored in local format 0XXXXXXXXX — the identity key across USSD, SMS and web',
    },
    email: { type: DataTypes.STRING(150), unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING(255), comment: 'Web login. Null for USSD-only farmers.' },
    pin: { type: DataTypes.STRING(255), comment: 'Hashed 4-digit USSD PIN' },
    role: { type: DataTypes.ENUM('farmer', 'buyer', 'agent', 'admin', 'superadmin'), defaultValue: 'farmer' },
    status: { type: DataTypes.ENUM('active', 'pending', 'suspended', 'banned'), defaultValue: 'active' },

    regionId: { type: DataTypes.INTEGER },
    districtId: { type: DataTypes.INTEGER },
    community: { type: DataTypes.STRING(120) },
    address: { type: DataTypes.STRING(255) },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },

    language: { type: DataTypes.ENUM('en', 'tw', 'ee', 'dag', 'ha'), defaultValue: 'en' },
    gender: { type: DataTypes.ENUM('male', 'female', 'other') },
    dateOfBirth: { type: DataTypes.DATEONLY },
    avatarUrl: { type: DataTypes.STRING(500) },
    bio: { type: DataTypes.TEXT },

    // Farmer profile
    farmSize: { type: DataTypes.DECIMAL(10, 2), comment: 'Acres' },
    farmingExperience: { type: DataTypes.INTEGER, comment: 'Years' },
    primaryCrops: json('primaryCrops', []),
    cooperative: { type: DataTypes.STRING(150) },

    // Buyer profile
    businessName: { type: DataTypes.STRING(150) },
    businessType: { type: DataTypes.ENUM('aggregator', 'wholesaler', 'retailer', 'processor', 'exporter', 'individual') },
    businessRegNumber: { type: DataTypes.STRING(80) },

    network: { type: DataTypes.STRING(30), comment: 'MTN / Telecel / AirtelTigo' },
    momoNumber: { type: DataTypes.STRING(15) },
    momoProvider: { type: DataTypes.ENUM('mtn', 'telecel', 'airteltigo') },
    walletBalance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    ratingAvg: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
    ratingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalSales: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
    totalPurchases: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },

    isPhoneVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    isEmailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    isVerifiedSeller: { type: DataTypes.BOOLEAN, defaultValue: false },
    smsNotifications: { type: DataTypes.BOOLEAN, defaultValue: true },
    priceAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },

    registrationChannel: { type: DataTypes.ENUM('ussd', 'web', 'sms', 'agent', 'seed'), defaultValue: 'web' },
    lastLoginAt: { type: DataTypes.DATE },
    lastUssdAt: { type: DataTypes.DATE },
    loginCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    ussdSessionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    suspendedReason: { type: DataTypes.STRING(255) },
    permissions: json('permissions', []),
  }, {
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    defaultScope: { attributes: { exclude: ['password', 'pin'] } },
    scopes: {
      withSecrets: { attributes: {} },
      active: { where: { status: 'active' } },
      farmers: { where: { role: 'farmer' } },
      buyers: { where: { role: 'buyer' } },
      admins: { where: { role: ['admin', 'superadmin'] } },
    },
    indexes: [
      { fields: ['phone'] }, { fields: ['role'] }, { fields: ['status'] },
      { fields: ['regionId'] }, { fields: ['registrationChannel'] },
    ],
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password') && user.password && !user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(user.password, env.bcryptRounds);
        }
        if (user.changed('pin') && user.pin && !user.pin.startsWith('$2')) {
          user.pin = await bcrypt.hash(user.pin, env.bcryptRounds);
        }
      },
    },
  });

  User.prototype.comparePassword = function (plain) {
    if (!this.password) return Promise.resolve(false);
    return bcrypt.compare(plain, this.password);
  };

  User.prototype.comparePin = function (plain) {
    if (!this.pin) return Promise.resolve(false);
    return bcrypt.compare(String(plain), this.pin);
  };

  User.prototype.isAdmin = function () {
    return ['admin', 'superadmin'].includes(this.role);
  };

  User.prototype.firstName = function () {
    return String(this.fullName || '').split(' ')[0];
  };

  User.prototype.toSafeJSON = function () {
    const { password, pin, deletedAt, ...rest } = this.toJSON();
    return rest;
  };

  return User;
};
