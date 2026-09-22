/**
 * Builds a production database: schema, reference data and the owner's
 * administrator account — and nothing else. The marketplace starts empty.
 *
 *   npm run db:production
 *
 * It refuses to touch a database that already holds accounts, because that is
 * either a live platform or one that needs a considered migration rather than
 * a rebuild. Pass --reset only for a database you are certain is disposable;
 * it drops every table first.
 */
const readline = require('readline');
const env = require('../config/env');
const { connectDatabase, sequelize, withoutForeignKeyChecks } = require('../config/database');
const { User } = require('../models');
const { seedProduction } = require('../seeders');
const { collect } = require('../config/validateEnv');
const logger = require('../utils/logger');

const reset = process.argv.includes('--reset');

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

(async () => {
  try {
    console.log('');
    logger.info(`Target: ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name} (${env.nodeEnv})`);

    // A production database built from a development .env would carry the
    // demo admin password straight into the live console.
    if (env.isProd) {
      const { errors } = collect();
      if (errors.length) {
        logger.error('The configuration is not production-ready yet:');
        errors.forEach(({ what, why }) => console.log(`   • ${what} ${why}`));
        console.log('\n  Fix .env first, then run this again.\n');
        process.exit(1);
      }
    } else {
      logger.warn('NODE_ENV is not "production" — the owner account will use the values in this .env.');
    }

    await connectDatabase();

    const existing = await User.count().catch(() => 0);
    if (existing && !reset) {
      logger.error(`This database already has ${existing} account(s).`);
      console.log('  Nothing was changed. If this really is a disposable database, run:');
      console.log('    npm run db:production -- --reset\n');
      process.exit(1);
    }

    if (reset) {
      const typed = await ask(
        `\n  \x1b[31mThis DROPS every table in "${env.db.name}", including any real accounts and orders.\x1b[0m\n  Type the database name to continue: `
      );
      if (typed !== env.db.name) {
        console.log('\n  Cancelled — nothing was changed.\n');
        process.exit(1);
      }
      await withoutForeignKeyChecks(() => sequelize.sync({ force: true }));
      logger.warn('Tables dropped and recreated');
    } else {
      await sequelize.sync();
      logger.success('Schema created');
    }

    const { superAdmin } = await seedProduction();

    console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  The platform is ready for its first real user            │
  ├──────────────────────────────────────────────────────────┤
  │  Admin console   ${`${env.clientUrl}/admin`.padEnd(40)}│
  │  Email           ${superAdmin.email.padEnd(40)}│
  │  Password        ${'(the SEED_ADMIN_PASSWORD in .env)'.padEnd(40)}│
  └──────────────────────────────────────────────────────────┘

  Next: sign in, open Settings and set the support line, USSD code and
  platform name. Then point the gateway callbacks at ${env.publicUrl}.
`);

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('Could not prepare the database:', err.message);
    if (err.code === 'ECONNREFUSED') logger.error('The database refused the connection — check DB_HOST, DB_PORT and that it is running.');
    process.exit(1);
  }
})();
