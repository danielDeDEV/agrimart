module.exports = (sequelize, DataTypes) => {
  const SmsMessage = sequelize.define('SmsMessage', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    direction: { type: DataTypes.ENUM('outbound', 'inbound'), defaultValue: 'outbound' },
    recipient: { type: DataTypes.STRING(15), allowNull: false },
    sender: { type: DataTypes.STRING(20) },
    message: { type: DataTypes.TEXT, allowNull: false },
    userId: { type: DataTypes.INTEGER },

    type: {
      type: DataTypes.ENUM(
        'otp', 'welcome', 'listing', 'order', 'offer', 'payment',
        'price_alert', 'price_digest', 'broadcast', 'reminder', 'support', 'system', 'inbound_command'
      ),
      defaultValue: 'system',
    },
    status: {
      // skipped = logged but deliberately not sent (safe mode, see SMS_ALLOWLIST)
      type: DataTypes.ENUM('queued', 'sending', 'sent', 'delivered', 'failed', 'rejected', 'skipped'),
      defaultValue: 'queued',
    },
    provider: { type: DataTypes.STRING(30), defaultValue: 'mock' },
    providerMessageId: { type: DataTypes.STRING(120) },
    network: { type: DataTypes.STRING(30) },

    segments: { type: DataTypes.INTEGER, defaultValue: 1 },
    cost: { type: DataTypes.DECIMAL(10, 4), defaultValue: 0 },
    currency: { type: DataTypes.STRING(5), defaultValue: 'GHS' },

    relatedType: { type: DataTypes.STRING(40), comment: 'listing | order | offer | broadcast' },
    relatedId: { type: DataTypes.INTEGER },
    broadcastId: { type: DataTypes.INTEGER },

    errorMessage: { type: DataTypes.STRING(255) },
    retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    sentAt: { type: DataTypes.DATE },
    deliveredAt: { type: DataTypes.DATE },
  }, {
    tableName: 'sms_messages',
    timestamps: true,
    indexes: [
      { fields: ['recipient'] }, { fields: ['userId'] }, { fields: ['status'] },
      { fields: ['type'] }, { fields: ['direction'] }, { fields: ['createdAt'] },
    ],
  });

  return SmsMessage;
};
