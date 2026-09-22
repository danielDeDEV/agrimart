/**
 * Takes a backup of the database and the uploaded photos.
 *
 *   npm run backup                 → ./backups/agrimarket-2026-09-21-0930.sql
 *   npm run backup -- --keep 14    → also deletes backups older than 14 days
 *
 * Point BACKUP_DIR somewhere off this machine (a mounted drive, a synced
 * folder) so a dead disk does not take the farmers' data with it. Restore with:
 *   mysql -u USER -p DATABASE < backups/the-file.sql
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const env = require('../config/env');
const logger = require('../utils/logger');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups'));
const keepDays = Number(arg('keep', process.env.BACKUP_KEEP_DAYS || 0));

const isPostgres = env.db.dialect === 'postgres';

/**
 * The dump tool is rarely on PATH on Windows: PostgreSQL keeps it under
 * Program Files and XAMPP ships its own MySQL copy. Set PG_DUMP_PATH or
 * MYSQLDUMP_PATH in .env to point at it directly.
 */
const findDumpTool = () => {
  const candidates = isPostgres
    ? [
        process.env.PG_DUMP_PATH,
        ...['18', '17', '16', '15', '14', '13'].map((v) => `C:/Program Files/PostgreSQL/${v}/bin/pg_dump.exe`),
        '/usr/bin/pg_dump',
        '/usr/local/bin/pg_dump',
        '/opt/homebrew/bin/pg_dump',
      ]
    : [
        process.env.MYSQLDUMP_PATH,
        'C:/xampp/mysql/bin/mysqldump.exe',
        '/usr/bin/mysqldump',
        '/usr/local/bin/mysqldump',
      ];
  return candidates.filter(Boolean).find((c) => fs.existsSync(c)) || (isPostgres ? 'pg_dump' : 'mysqldump');
};

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

function prune() {
  if (!keepDays) return;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of fs.readdirSync(backupDir)) {
    if (!file.endsWith('.sql')) continue;
    const full = path.join(backupDir, file);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  if (removed) logger.info(`Removed ${removed} backup(s) older than ${keepDays} days`);
}

(async () => {
  fs.mkdirSync(backupDir, { recursive: true });
  const target = path.join(backupDir, `${env.db.name}-${stamp()}.sql`);
  const dump = findDumpTool();

  logger.info(`Backing up ${env.db.name} → ${target}`);

  const args = isPostgres
    ? [
        `--host=${env.db.host}`,
        `--port=${env.db.port}`,
        `--username=${env.db.user}`,
        '--no-password',       // the password comes from PGPASSWORD below
        '--format=plain',
        '--no-owner',          // so it restores under whatever user you have
        '--no-privileges',
        '--clean',
        '--if-exists',
        env.db.name,
      ]
    : [
        `--host=${env.db.host}`,
        `--port=${env.db.port}`,
        `--user=${env.db.user}`,
        ...(env.db.password ? [`--password=${env.db.password}`] : []),
        '--single-transaction',
        '--quick',
        '--routines',
        '--events',
        '--default-character-set=utf8mb4',
        env.db.name,
      ];

  const out = fs.createWriteStream(target);
  const child = spawn(dump, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    // pg_dump never takes a password on the command line
    env: { ...process.env, ...(isPostgres && env.db.password ? { PGPASSWORD: env.db.password } : {}) },
  });
  child.stdout.pipe(out);

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('error', (err) => {
    logger.error(`Could not run ${isPostgres ? 'pg_dump' : 'mysqldump'} (${dump}): ${err.message}`);
    logger.error(`Set ${isPostgres ? 'PG_DUMP_PATH' : 'MYSQLDUMP_PATH'} in .env to its full path.`);
    process.exit(1);
  });

  child.on('close', (code) => {
    out.end();
    // A password on the command line always draws this warning; it is not an error.
    const realErrors = stderr.split('\n').filter((l) => l.trim() && !/insecure|Using a password/i.test(l));
    if (code !== 0) {
      logger.error(`Backup failed (exit ${code}): ${realErrors.join(' ') || stderr}`);
      fs.rmSync(target, { force: true });
      process.exit(1);
    }
    const mb = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
    logger.success(`Database backed up: ${path.basename(target)} (${mb} MB)`);

    const uploads = path.resolve(__dirname, '..', '..', 'uploads');
    if (fs.existsSync(uploads)) {
      const count = fs.readdirSync(uploads, { recursive: true }).filter((f) => String(f).includes('.')).length;
      logger.info(`Remember the photos too: ${uploads} holds ${count} file(s) that this dump does not contain.`);
    }

    prune();
    process.exit(0);
  });
})();
