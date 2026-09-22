module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reference: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    orderId: { type: DataTypes.INTEGER },

    type: {
      type: DataTypes.ENUM('payment', 'payout', 'commission', 'refund', 'topup', 'withdrawal', 'reversal'),
      allowNull: false,
    },
    direction: { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    fee: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    netAmount: { type: DataTypes.DECIMAL(14, 2) },
    currency: { type: DataTypes.STRING(5), defaultValue: 'GHS' },
    balanceAfter: { type: DataTypes.DECIMAL(14, 2) },

    method: { type: DataTypes.ENUM('momo', 'bank', 'cash', 'wallet'), defaultValue: 'momo' },
    provider: { type: DataTypes.ENUM('mtn', 'telecel', 'airteltigo', 'bank', 'internal'), defaultValue: 'mtn' },
    accountNumber: { type: DataTypes.STRING(20) },
    accountName: { type: DataTypes.STRING(120) },
    externalReference: { type: DataTypes.STRING(120) },

    status: {
      type: DataTypes.ENUM('pending', 'processing', 'success', 'failed', 'reversed'),
      defaultValue: 'pending',
    },
    description: { type: DataTypes.STRING(255) },
    failureReason: { type: DataTypes.STRING(255) },
    processedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] }, { fields: ['orderId'] }, { fields: ['status'] },
      { fields: ['type'] }, { fields: ['createdAt'] },
    ],
    hooks: {
      beforeSave: (tx) => {
        tx.netAmount = Number(tx.amount || 0) - Number(tx.fee || 0);
      },
    },
  });

  return Transaction;
};
