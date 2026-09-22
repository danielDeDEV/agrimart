const { connectDatabase, sequelize, withoutForeignKeyChecks } = require('../config/database');
require('../models');
const logger = require('../utils/logger');

(async () => {
  try {
    await connectDatabase();
    await withoutForeignKeyChecks(() => sequelize.sync({ force: true }));
    logger.warn('All tables dropped and recreated — the database is now empty');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('Reset failed:', err.message);
    process.exit(1);
  }
})();
