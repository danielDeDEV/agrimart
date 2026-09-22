const { json } = require('../utils/jsonType');

module.exports = (sequelize, DataTypes) => {
  const UssdSession = sequelize.define('UssdSession', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    sessionId: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(15), allowNull: false },
    userId: { type: DataTypes.INTEGER },
    serviceCode: { type: DataTypes.STRING(30) },
    network: { type: DataTypes.STRING(30) },

    state: {
      type: DataTypes.STRING(60), defaultValue: 'MAIN_MENU',
      comment: 'Current node of the USSD state machine',
    },
    previousState: { type: DataTypes.STRING(60) },
    // Values collected across the session (produce, quantity, price...)
    data: json('data', {}),
    // Every input/output pair - replayed in the admin USSD inspector
    history: json('history', []),

    status: { type: DataTypes.ENUM('active', 'completed', 'timeout', 'aborted', 'error'), defaultValue: 'active' },
    stepCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    outcome: {
      type: DataTypes.STRING(60),
      comment: 'registered | listing_created | order_placed | price_checked | ...',
    },
    durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastInput: { type: DataTypes.STRING(160) },
    endedAt: { type: DataTypes.DATE },
    isSimulated: {
      type: DataTypes.BOOLEAN, defaultValue: false,
      comment: 'True when driven by the website USSD simulator instead of a real handset',
    },
  }, {
    tableName: 'ussd_sessions',
    timestamps: true,
    indexes: [
      { fields: ['sessionId'] }, { fields: ['phone'] }, { fields: ['userId'] },
      { fields: ['status'] }, { fields: ['createdAt'] },
    ],
  });

  UssdSession.prototype.pushHistory = function (input, output) {
    const history = Array.isArray(this.history) ? [...this.history] : [];
    history.push({ step: history.length + 1, input, output, at: new Date().toISOString() });
    this.history = history.slice(-40);
  };

  return UssdSession;
};
