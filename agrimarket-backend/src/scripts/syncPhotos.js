/**
 * Applies the built-in photo library to the database on demand
 * (the API also does this on start-up). Usage: npm run photos:sync
 */
const { connectDatabase, sequelize } = require('../config/database');
const { ensureCatalogPhotos } = require('../services/catalogPhotoService');
const logger = require('../utils/logger');

(async () => {
  try {
    await connectDatabase();
    const result = await ensureCatalogPhotos();
    if (!result.produce && !result.categories && !result.listings) {
      logger.success('Photo library already up to date');
    }
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('Photo sync failed:', err.message);
    process.exit(1);
  }
})();
