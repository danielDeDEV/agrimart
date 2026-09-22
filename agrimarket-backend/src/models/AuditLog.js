const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER },
    actorName: { type: DataTypes.STRING(120) },
    actorRole: { type: DataTypes.STRING(30) },
    action: { type: DataTypes.STRING(80), allowNull: false, comment: 'e.g. listing.approve, user.suspend' },
    entity: { type: DataTypes.STRING(60) },
    entityId: { type: DataTypes.INTEGER },
    description: { type: DataTypes.STRING(255) },
    oldValue: json('oldValue', null),
    newValue: json('newValue', null),
    ipAddress: { type: DataTypes.STRING(60) },
    userAgent: { type: DataTypes.STRING(255) },
    severity: { type: DataTypes.ENUM('info', 'warning', 'critical'), defaultValue: 'info' },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['userId'] }, { fields: ['action'] }, { fields: ['entity'] }, { fields: ['createdAt'] }],
  });

  return AuditLog;
};
