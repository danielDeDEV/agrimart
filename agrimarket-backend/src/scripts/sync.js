const { connectDatabase, sequelize } = require('../config/database');
require('../models');
const logger = require('../utils/logger');

(async () => {
  try {
    await connectDatabase();
    await sequelize.sync({ alter: true });
    logger.success('Schema synchronised with the models');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('Sync failed:', err.message);
    process.exit(1);
  }
})();
