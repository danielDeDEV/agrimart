const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const Otp = sequelize.define('Otp', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    phone: { type: DataTypes.STRING(15), allowNull: false },
    code: { type: DataTypes.STRING(10), allowNull: false },
    purpose: {
      type: DataTypes.ENUM('registration', 'login', 'reset_password', 'reset_pin', 'verify_phone', 'transaction'),
      defaultValue: 'verify_phone',
    },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    isUsed: { type: DataTypes.BOOLEAN, defaultValue: false },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    usedAt: { type: DataTypes.DATE },
    meta: json('meta', {}),
  }, {
    tableName: 'otps',
    timestamps: true,
    indexes: [{ fields: ['phone'] }, { fields: ['expiresAt'] }],
  });

  Otp.prototype.isValid = function () {
    return !this.isUsed && this.attempts < 5 && new Date(this.expiresAt) > new Date();
  };

  return Otp;
};
