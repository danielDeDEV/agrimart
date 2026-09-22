const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * The database connection.
 *
 * PostgreSQL is the default: it is what the platform runs on in production and
 * what every free host offers. MySQL/MariaDB still works by setting
 * DB_DIALECT=mysql, which is what the one-time migration script uses to read
 * the old database while writing to the new one.
 */

const isPostgres = env.db.dialect === 'postgres';

/** Hosted databases hand you one connection string; it wins over the parts. */
const dialectOptions = {
  ...(isPostgres && env.db.ssl
    ? { ssl: { require: true, rejectUnauthorized: env.db.sslRejectUnauthorized } }
    : {}),
  ...(env.db.dialect === 'mysql' ? { dateStrings: false } : {}),
};

const common = {
  dialect: env.db.dialect,
  logging: env.db.logging ? (msg) => logger.debug(msg) : false,
  define: {
    underscored: false,
    freezeTableName: false,
    ...(isPostgres ? {} : { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }),
  },
  pool: { max: 15, min: 0, acquire: 60000, idle: 10000 },
  timezone: isPostgres ? undefined : '+00:00',
  retry: { max: 3 },
  dialectOptions,
};

const sequelize = env.db.url
  ? new Sequelize(env.db.url, common)
  : new Sequelize(env.db.name, env.db.user, env.db.password, {
      host: env.db.host,
      port: env.db.port,
      ...common,
    });

/**
 * Creates the database on first boot so a fresh install needs no manual step.
 *
 * Postgres has no "CREATE DATABASE IF NOT EXISTS", and cannot create one from
 * inside a transaction or from the database being created — so this connects
 * to the maintenance database, looks in pg_database, and creates it only if it
 * is missing. A hosted database already exists and the user usually lacks the
 * right to create another, so this is skipped when DATABASE_URL is set.
 */
async function ensureDatabaseExists() {
  if (env.db.url) return; // a hosted database is handed to us ready-made

  if (isPostgres) {
    const { Client } = require('pg');
    const client = new Client({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: 'postgres',
      ...(env.db.ssl ? { ssl: { rejectUnauthorized: env.db.sslRejectUnauthorized } } : {}),
    });

    await client.connect();
    try {
      const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.db.name]);
      if (!rows.length) {
        // The name cannot be a parameter in DDL, so it is quoted instead
        await client.query(`CREATE DATABASE "${env.db.name.replace(/"/g, '""')}" ENCODING 'UTF8'`);
        logger.success(`Database "${env.db.name}" created`);
      } else {
        logger.success(`Database "${env.db.name}" is ready`);
      }
    } finally {
      await client.end();
    }
    return;
  }

  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await connection.end();
  logger.success(`Database "${env.db.name}" is ready`);
}

async function connectDatabase() {
  // Creating the schema is a convenience for a fresh install. A production
  // user is deliberately granted rights to one database and nothing more, so
  // there the server simply connects to the database that is there.
  if (env.isProd) {
    try {
      await sequelize.authenticate();
    } catch (err) {
      const missing = err.original?.code === 'ER_BAD_DB_ERROR' || err.original?.code === '3D000';
      if (missing) {
        throw new Error(`Database "${env.db.name}" does not exist. Create it, then run: npm run db:production`);
      }
      throw err;
    }
    logger.success(`Connected to ${env.db.dialect} at ${env.db.host}:${env.db.port}`);
    return sequelize;
  }

  await ensureDatabaseExists();
  await sequelize.authenticate();
  logger.success(`Connected to ${env.db.dialect} at ${env.db.url ? 'the configured host' : `${env.db.host}:${env.db.port}`}`);
  return sequelize;
}

/**
 * Runs `work` with foreign keys not enforced, so tables can be dropped or
 * emptied in any order. Each dialect does this differently; callers should not
 * have to care.
 */
async function withoutForeignKeyChecks(work) {
  if (isPostgres) {
    // session_replication_role = replica suspends triggers, foreign keys
    // included, for this session only. It needs superuser or the replication
    // role; where that is refused, the work runs with the keys still on and
    // the caller's own ordering has to be right.
    try {
      await sequelize.query("SET session_replication_role = 'replica'");
      try {
        return await work();
      } finally {
        await sequelize.query("SET session_replication_role = 'origin'");
      }
    } catch (err) {
      if (!/permission|must be superuser/i.test(err.message)) throw err;
      logger.warn('Foreign keys stay enforced — this database user cannot suspend them');
      return work();
    }
  }

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    return await work();
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

module.exports = { sequelize, connectDatabase, ensureDatabaseExists, withoutForeignKeyChecks, isPostgres, Sequelize };
