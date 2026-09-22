const http = require('http');
const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { validateEnv } = require('./config/validateEnv');
const { connectDatabase, sequelize } = require('./config/database');
const { initSockets } = require('./sockets');
const { startJobs, stopJobs } = require('./jobs');
const { ensureCatalogPhotos } = require('./services/catalogPhotoService');
const { ensureSchema } = require('./services/schemaPatches');
const settingsService = require('./services/settingsService');

const server = http.createServer(app);

const banner = () => {
  const line = '─'.repeat(58);
  console.log(`\n\x1b[32m┌${line}┐\x1b[0m`);
  console.log(`\x1b[32m│\x1b[0m  \x1b[1mAgriMart Ghana — API\x1b[0m${' '.repeat(32)}\x1b[32m│\x1b[0m`);
  console.log(`\x1b[32m│\x1b[0m  USSD/SMS platform for smallholder farmers${' '.repeat(14)}\x1b[32m│\x1b[0m`);
  console.log(`\x1b[32m└${line}┘\x1b[0m`);
  console.log(`  API        http://localhost:${env.port}${env.apiPrefix}`);
  console.log(`  Health     http://localhost:${env.port}/health`);
  console.log(`  USSD hook  http://localhost:${env.port}${env.apiPrefix}/ussd`);
  console.log(`  SMS hook   http://localhost:${env.port}${env.apiPrefix}/sms/inbound`);
  console.log(`  Website    ${env.clientUrl}`);
  console.log(`  SMS mode   ${env.sms.provider}${env.sms.provider === 'mock' ? ' (messages are logged, not billed)' : ''}`);
  console.log('');
};

async function start() {
  try {
    // Refuses to boot on a production .env that still has development values
    validateEnv();

    await connectDatabase();

    // In development we let Sequelize keep the schema in step with the models
    // so a fresh XAMPP install needs no manual SQL at all. A live database is
    // never reshaped on boot: `npm run db:setup` does that, deliberately.
    if (env.isProd && process.env.DB_SYNC !== 'true') {
      logger.info('Schema sync skipped (production). Run npm run db:setup after a deploy that adds tables.');
    } else {
      const alter = process.env.DB_SYNC_ALTER === 'true';
      await sequelize.sync({ alter });
      logger.success(`Schema synchronised${alter ? ' (alter mode)' : ''}`);
    }

    // Databases created by an earlier version get upgraded in place
    await ensureSchema();
    await ensureCatalogPhotos().catch((err) => logger.warn('Photo library check skipped:', err.message));

    // Admin → Settings drives SMS wording, USSD screens and the website
    await settingsService.load();

    initSockets(server);
    if (process.env.DISABLE_CRON !== 'true') startJobs();

    server.listen(env.port, () => {
      banner();
      logger.success(`Server listening on port ${env.port} in ${env.nodeEnv} mode`);
    });
  } catch (err) {
    logger.error('Startup failed:', err.message);
    if (err.name?.includes('SequelizeConnection') || err.code === 'ECONNREFUSED') {
      logger.error('Could not reach MySQL. Open the XAMPP Control Panel and start MySQL, then try again.');
    }
    process.exit(1);
  }
}

const shutdown = async (signal) => {
  logger.warn(`${signal} received — shutting down gracefully`);
  stopJobs();
  server.close(async () => {
    await sequelize.close().catch(() => {});
    logger.info('Goodbye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err.message, err.stack);
  process.exit(1);
});

start();

module.exports = server;
