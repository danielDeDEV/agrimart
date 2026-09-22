const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const SupportTicket = sequelize.define('SupportTicket', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(120) },
    phone: { type: DataTypes.STRING(15) },
    email: { type: DataTypes.STRING(150) },
    subject: { type: DataTypes.STRING(180), allowNull: false },
    category: {
      type: DataTypes.ENUM('account', 'listing', 'order', 'payment', 'ussd', 'sms', 'technical', 'other'),
      defaultValue: 'other',
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    // Screenshots the person attached: MoMo confirmations, photos of the goods
    attachments: json('attachments', []),
    // Set when the ticket was raised from a specific order
    orderId: { type: DataTypes.INTEGER },
    channel: { type: DataTypes.ENUM('web', 'ussd', 'sms', 'phone'), defaultValue: 'web' },
    priority: { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' },
    status: { type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'), defaultValue: 'open' },
    assignedTo: { type: DataTypes.INTEGER },
    response: { type: DataTypes.TEXT },
    respondedAt: { type: DataTypes.DATE },
    resolvedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'support_tickets',
    timestamps: true,
    indexes: [{ fields: ['status'] }, { fields: ['userId'] }, { fields: ['createdAt'] }],
  });

  return SupportTicket;
};
