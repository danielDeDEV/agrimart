module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define('Setting', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    value: { type: DataTypes.TEXT },
    type: { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' },
    group: {
      type: DataTypes.ENUM('general', 'sms', 'ussd', 'payment', 'marketplace', 'notification', 'security'),
      defaultValue: 'general',
    },
    label: { type: DataTypes.STRING(150) },
    description: { type: DataTypes.STRING(255) },
    isPublic: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Exposed to the website without auth' },
    isEditable: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'settings', timestamps: true });

  Setting.parse = (row) => {
    if (!row) return null;
    switch (row.type) {
      case 'number': return Number(row.value);
      case 'boolean': return row.value === 'true' || row.value === '1';
      case 'json': try { return JSON.parse(row.value); } catch { return null; }
      default: return row.value;
    }
  };

  return Setting;
};
