const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const Broadcast = sequelize.define('Broadcast', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    audience: {
      type: DataTypes.ENUM('all', 'farmers', 'buyers', 'agents', 'region', 'district', 'produce', 'custom'),
      defaultValue: 'all',
    },
    // regionId / districtId / produceId / phones[] depending on audience
    filters: json('filters', {}),
    channel: { type: DataTypes.ENUM('sms', 'in_app', 'both'), defaultValue: 'sms' },
    recipientCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    sentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    failedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    estimatedCost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'),
      defaultValue: 'draft',
    },
    scheduledAt: { type: DataTypes.DATE },
    sentAt: { type: DataTypes.DATE },
    createdBy: { type: DataTypes.INTEGER },
  }, {
    tableName: 'broadcasts',
    timestamps: true,
    indexes: [{ fields: ['status'] }, { fields: ['createdAt'] }],
  });

  return Broadcast;
};
