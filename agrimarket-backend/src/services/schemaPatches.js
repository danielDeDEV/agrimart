const { sequelize } = require('../models');
const { isPostgres } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Small, idempotent schema changes for databases created by an earlier
 * version. The server syncs without `alter` — safer on real data — so a new
 * column or a new enum value would otherwise never reach an existing table.
 *
 * Everything here is written to work on PostgreSQL and MySQL alike, because
 * the same database may be migrated between them.
 */

/** Column types, per dialect, for the patches below. */
const TYPES = {
  json: () => (isPostgres ? 'JSONB' : 'LONGTEXT'),
  integer: () => (isPostgres ? 'INTEGER' : 'INT'),
};

/** Identifiers are quoted the way the active dialect expects. */
const q = (name) => (isPostgres ? `"${name.replace(/"/g, '""')}"` : `\`${name.replace(/`/g, '``')}\``);

/** True when the table already has that column. */
async function hasColumn(table, column) {
  const [rows] = await sequelize.query(
    isPostgres
      ? `SELECT 1 AS found FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column`
      : `SELECT 1 AS found FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

/** Adds a column only when the table does not already have it. */
async function ensureColumn(table, column, type) {
  if (await hasColumn(table, column)) return false;
  await sequelize.query(`ALTER TABLE ${q(table)} ADD COLUMN ${q(column)} ${type} NULL`);
  logger.success(`Database updated: ${table}.${column} added`);
  return true;
}

/**
 * Makes sure an enum column accepts a value.
 *
 * The two dialects could hardly be less alike here: MySQL redeclares the whole
 * column, while Postgres has a real type that gains values one at a time and
 * cannot do it inside a transaction.
 */
async function ensureEnumValue(table, column, value, allValues) {
  if (isPostgres) {
    const [rows] = await sequelize.query(
      `SELECT e.enumlabel AS label
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN information_schema.columns c
           ON c.udt_name = t.typname AND c.table_name = :table AND c.column_name = :column
        WHERE c.table_schema = current_schema()`,
      { replacements: { table, column } }
    );
    if (!rows.length || rows.some((r) => r.label === value)) return false;

    const [[{ udt_name: typeName }]] = await sequelize.query(
      `SELECT udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column`,
      { replacements: { table, column } }
    );
    await sequelize.query(`ALTER TYPE ${q(typeName)} ADD VALUE IF NOT EXISTS '${value}'`);
    logger.success(`Database updated: ${table}.${column} accepts "${value}"`);
    return true;
  }

  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  const current = rows[0]?.type || '';
  if (!current || current.includes(`'${value}'`)) return false;

  const list = allValues.map((v) => `'${v}'`).join(',');
  await sequelize.query(
    `ALTER TABLE ${q(table)} MODIFY ${q(column)} ENUM(${list}) NULL DEFAULT '${allValues[0]}'`
  );
  logger.success(`Database updated: ${table}.${column} accepts "${value}"`);
  return true;
}

async function ensureSchema() {
  // Evidence for payments and complaints (screenshots, and the order involved)
  await ensureColumn('support_tickets', 'attachments', TYPES.json());
  await ensureColumn('support_tickets', 'orderId', TYPES.integer());
  await ensureColumn('orders', 'paymentProof', TYPES.json());

  // Safe mode records a message as "skipped" rather than sending it
  await ensureEnumValue('sms_messages', 'status', 'skipped', [
    'queued', 'sending', 'sent', 'delivered', 'failed', 'rejected', 'skipped',
  ]);
}

module.exports = { ensureSchema, ensureColumn, ensureEnumValue, hasColumn };
