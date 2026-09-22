module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(150), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: {
      type: DataTypes.ENUM('order', 'offer', 'listing', 'payment', 'price', 'system', 'support', 'account'),
      defaultValue: 'system',
    },
    priority: { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' },
    icon: { type: DataTypes.STRING(40), defaultValue: 'Bell' },
    link: { type: DataTypes.STRING(255) },
    relatedType: { type: DataTypes.STRING(40) },
    relatedId: { type: DataTypes.INTEGER },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    readAt: { type: DataTypes.DATE },
    sentViaSms: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'notifications',
    timestamps: true,
    indexes: [{ fields: ['userId'] }, { fields: ['isRead'] }, { fields: ['createdAt'] }],
  });

  return Notification;
};
