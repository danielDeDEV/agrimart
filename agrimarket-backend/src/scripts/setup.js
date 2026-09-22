/**
 * One-shot bootstrap for a fresh XAMPP install:
 * creates the database, builds the schema and loads the seed data.
 */
const { connectDatabase, sequelize } = require('../config/database');
const { seed } = require('../seeders');
const logger = require('../utils/logger');

(async () => {
  try {
    logger.info('Setting up AgriMart…');
    await connectDatabase();
    await seed({ force: true });
    await sequelize.close();
    logger.success('Setup complete. Run "npm run dev" to start the API.');
    process.exit(0);
  } catch (err) {
    logger.error('Setup failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      logger.error('MySQL is not reachable. Start MySQL from the XAMPP Control Panel and run this again.');
    }
    process.exit(1);
  }
})();
