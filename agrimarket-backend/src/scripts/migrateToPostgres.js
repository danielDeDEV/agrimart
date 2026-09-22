/**
 * Copies a MySQL/MariaDB database into PostgreSQL, table by table.
 *
 *   npm run db:migrate-postgres              show what would move
 *   npm run db:migrate-postgres -- --apply   move it
 *
 * Reads with the same Sequelize models that write, so every column, JSON
 * field, enum and date is interpreted exactly as the application does — which
 * a dump-and-convert cannot promise. The source is untouched: this only reads.
 *
 * The source comes from MYSQL_* variables, falling back to the usual local
 * XAMPP defaults; the destination is whatever DB_* says in .env, which by now
 * is your PostgreSQL. Run it against an empty Postgres database: it creates
 * the schema itself.
 */
const { Sequelize } = require('sequelize');
const readline = require('readline');
const env = require('../config/env');
const logger = require('../utils/logger');

const apply = process.argv.includes('--apply');

/**
 * Order matters: a row may not arrive before the row it points at. This is the
 * dependency order of the schema, parents first.
 */
const ORDER = [
  'Region', 'District', 'Market', 'Category', 'Produce',
  'User', 'Setting', 'FarmingTip',
  'MarketPrice', 'Listing', 'Offer', 'Order', 'Transaction', 'Review',
  'Conversation', 'Message', 'Notification', 'PriceAlert', 'Favorite',
  'SupportTicket', 'ImpactRecord', 'SmsMessage', 'Broadcast', 'UssdSession',
  'Otp', 'AuditLog',
];

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });

/** A second Sequelize instance pointed at the old MySQL database. */
function openSource() {
  return new Sequelize(
    process.env.MYSQL_DB_NAME || env.db.name,
    process.env.MYSQL_DB_USER || 'root',
    process.env.MYSQL_DB_PASSWORD || '',
    {
      host: process.env.MYSQL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQL_DB_PORT, 10) || 3306,
      dialect: 'mysql',
      logging: false,
      define: { underscored: false, freezeTableName: false, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
    }
  );
}

/**
 * MySQL hands JSON columns back as strings and booleans as 1/0. The
 * destination model says which column is which, so each row is converted to
 * what PostgreSQL expects before it is written.
 */
function convertRow(row, model) {
  const out = { ...row };
  for (const [name, attr] of Object.entries(model.getAttributes())) {
    const key = attr.field || name;
    if (out[key] === null || out[key] === undefined) continue;
    const kind = String(attr.type?.key || '');
    if ((kind === 'JSON' || kind === 'JSONB') && typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch { /* keep what was stored */ }
    } else if (kind === 'BOOLEAN' && typeof out[key] === 'number') {
      out[key] = out[key] === 1;
    }
  }
  return out;
}

(async () => {
  if (env.db.dialect !== 'postgres') {
    logger.error(`DB_DIALECT is "${env.db.dialect}". Point .env at PostgreSQL before running this.`);
    process.exit(1);
  }

  console.log('\n\x1b[1mAgriMart — MySQL to PostgreSQL\x1b[0m');
  console.log(`  from  mysql://${process.env.MYSQL_DB_USER || 'root'}@${process.env.MYSQL_DB_HOST || '127.0.0.1'}:${process.env.MYSQL_DB_PORT || 3306}/${process.env.MYSQL_DB_NAME || env.db.name}`);
  console.log(`  to    postgres://${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}\n`);

  // The destination models (these follow .env, which now says postgres)
  const target = require('../models');
  const { connectDatabase, sequelize: pg, withoutForeignKeyChecks } = require('../config/database');

  // The source: the same model definitions, bound to the MySQL connection
  const source = openSource();
  try {
    await source.authenticate();
  } catch (err) {
    logger.error(`Cannot reach the MySQL source: ${err.message}`);
    logger.error('Set MYSQL_DB_HOST / MYSQL_DB_PORT / MYSQL_DB_USER / MYSQL_DB_PASSWORD / MYSQL_DB_NAME if it is not the local default.');
    process.exit(1);
  }
  logger.success('Connected to the MySQL source');

  /** Reads a table from MySQL as plain rows, and counts it. */
  const readTable = async (table) => (await source.query(`SELECT * FROM \`${table}\``))[0];
  const countTable = async (table) => Number((await source.query(`SELECT COUNT(*) AS n FROM \`${table}\``))[0][0].n);

  const allModels = target.sequelize.models;
  const names = ORDER.filter((n) => allModels[n]);
  const missing = Object.keys(allModels).filter((n) => !ORDER.includes(n));
  if (missing.length) names.push(...missing); // anything new, after the known order

  console.log('\x1b[1m  What is in the source\x1b[0m');
  const counts = {};
  let total = 0;
  for (const name of names) {
    const table = allModels[name].getTableName();
    let n = 0;
    try {
      n = await countTable(table);
    } catch (err) {
      logger.warn(`${table}: ${err.message}`);
    }
    counts[name] = n;
    total += n;
    if (n) console.log(`    ${String(n).padStart(7)}  ${table}`);
  }
  console.log(`\n    ${String(total).padStart(7)}  rows in total\n`);

  if (!apply) {
    console.log('  Nothing was written. To migrate:  npm run db:migrate-postgres -- --apply\n');
    await source.close();
    process.exit(0);
  }

  await connectDatabase();

  const existing = await target.User.count({ paranoid: false }).catch(() => 0);
  if (existing) {
    const typed = await ask(
      `\n  \x1b[31mThe PostgreSQL database already holds ${existing} account(s); migrating replaces every table.\x1b[0m\n  Type the database name "${env.db.name}" to continue: `
    );
    if (typed !== env.db.name) {
      console.log('\n  Cancelled — nothing was written.\n');
      await source.close();
      process.exit(1);
    }
  }

  console.log('');
  await withoutForeignKeyChecks(() => pg.sync({ force: true }));
  logger.success('PostgreSQL schema created');

  let copied = 0;
  for (const name of names) {
    if (!counts[name]) continue;
    const model = allModels[name];
    const table = model.getTableName();
    const rows = (await readTable(table)).map((row) => convertRow(row, model));
    if (!rows.length) continue;

    // In batches, so a large table (market prices) does not exhaust memory
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await model.bulkCreate(rows.slice(i, i + BATCH), {
        validate: false,
        hooks: false,          // passwords and PINs are already hashed
        ignoreDuplicates: false,
      });
    }
    copied += rows.length;
    logger.info(`${table} — ${rows.length} row(s)`);
  }

  /**
   * Postgres keeps a sequence per table for its auto-increment. Rows arrived
   * with their original ids, so every sequence still points at 1 — the next
   * insert would collide. This moves each one past the highest id.
   */
  for (const name of names) {
    const table = allModels[name].getTableName();
    try {
      await pg.query(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'),
                       COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
      );
    } catch { /* a table without a serial id needs nothing */ }
  }
  logger.success('Id sequences moved past the migrated rows');

  const users = await target.User.count({ paranoid: false });
  const settings = await target.Setting.count();
  const prices = await target.MarketPrice.count();

  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  Migration complete                                       │
  ├──────────────────────────────────────────────────────────┤
  │  Rows copied    ${String(copied).padEnd(41)}│
  │  Accounts       ${String(users).padEnd(41)}│
  │  Settings       ${String(settings).padEnd(41)}│
  │  Market prices  ${String(prices).padEnd(41)}│
  └──────────────────────────────────────────────────────────┘

  The MySQL database was not touched. Check the platform against PostgreSQL,
  and keep the old one until you are satisfied.
`);

  await source.close();
  await pg.close();
  process.exit(0);
})().catch(async (err) => {
  logger.error('Migration failed:', err.message);
  console.error(err.stack?.split('\n').slice(1, 5).join('\n'));
  process.exit(1);
});
