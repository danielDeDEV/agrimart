const { connectDatabase, sequelize } = require('../config/database');
const { seed } = require('../seeders');
const logger = require('../utils/logger');

(async () => {
  try {
    await connectDatabase();
    await seed({ force: true });
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('Seeding failed:', err.message, err.stack);
    process.exit(1);
  }
})();
