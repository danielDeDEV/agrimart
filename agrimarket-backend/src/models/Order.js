const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    listingId: { type: DataTypes.INTEGER, allowNull: false },
    buyerId: { type: DataTypes.INTEGER, allowNull: false },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },

    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(30), allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    commission: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    deliveryFee: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    totalAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    farmerPayout: { type: DataTypes.DECIMAL(14, 2) },
    currency: { type: DataTypes.STRING(5), defaultValue: 'GHS' },

    status: {
      type: DataTypes.ENUM(
        'pending', 'accepted', 'rejected', 'paid', 'in_transit',
        'delivered', 'completed', 'cancelled', 'disputed'
      ),
      defaultValue: 'pending',
    },
    paymentMethod: { type: DataTypes.ENUM('momo', 'cash', 'bank', 'wallet'), defaultValue: 'momo' },
    paymentStatus: {
      type: DataTypes.ENUM('unpaid', 'pending', 'paid', 'refunded', 'failed'),
      defaultValue: 'unpaid',
    },
    paymentReference: { type: DataTypes.STRING(80) },
    /**
     * What the buyer says they paid and how, with screenshots. The platform
     * does not move money, so this is the evidence the farmer checks against
     * their own MoMo messages before confirming the payment arrived.
     */
    paymentProof: json('paymentProof', null),

    deliveryMethod: { type: DataTypes.ENUM('pickup', 'delivery', 'transporter'), defaultValue: 'pickup' },
    deliveryAddress: { type: DataTypes.STRING(255) },
    deliveryContact: { type: DataTypes.STRING(15) },
    expectedDeliveryDate: { type: DataTypes.DATEONLY },
    deliveredAt: { type: DataTypes.DATE },

    notes: { type: DataTypes.TEXT },
    cancellationReason: { type: DataTypes.STRING(255) },
    disputeReason: { type: DataTypes.TEXT },
    source: { type: DataTypes.ENUM('ussd', 'web', 'sms', 'agent'), defaultValue: 'web' },
    // Append-only status history powering the order tracking view
    timeline: json('timeline', []),

    acceptedAt: { type: DataTypes.DATE },
    completedAt: { type: DataTypes.DATE },
    farmerRated: { type: DataTypes.BOOLEAN, defaultValue: false },
    buyerRated: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'orders',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['buyerId'] }, { fields: ['farmerId'] }, { fields: ['listingId'] },
      { fields: ['status'] }, { fields: ['createdAt'] },
    ],
  });

  Order.prototype.pushTimeline = function (status, note, actor) {
    const timeline = Array.isArray(this.timeline) ? [...this.timeline] : [];
    timeline.push({
      status,
      note: note || null,
      actor: actor || 'system',
      at: new Date().toISOString(),
    });
    this.timeline = timeline;
  };

  return Order;
};
