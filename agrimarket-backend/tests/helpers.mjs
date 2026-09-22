/**
 * Shared plumbing for the test suites.
 *
 * The tests run against a *running* API and a real database, because that is
 * what they are for: proving the USSD engine, the SMS gateway, the permission
 * rules and the upload rules behave against the real stack rather than against
 * mocks of it. Start the API first, then `npm test`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
export const BACKEND_DIR = resolve(TESTS_DIR, '..');
export const PROJECT_DIR = resolve(BACKEND_DIR, '..');
export const FRONTEND_DIR = join(PROJECT_DIR, 'agrimarket-frontend');

/** Reads a value from the backend .env without pulling in dotenv. */
export function envValue(key, fallback = '') {
  const file = join(BACKEND_DIR, '.env');
  if (!existsSync(file)) return process.env[key] ?? fallback;
  const line = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'));
  const value = line?.[1]?.trim().replace(/^["']|["']$/g, '');
  return process.env[key] ?? (value || fallback);
}

const port = envValue('PORT', '5000');
const prefix = envValue('API_PREFIX', '/api/v1');
export const API = process.env.TEST_API_URL || `http://localhost:${port}${prefix}`;
export const ORIGIN = API.replace(prefix, '');
export const DB_NAME = envValue('DB_NAME', 'agrimarket');
export const DB_USER = envValue('DB_USER', 'root');
export const DB_PASSWORD = envValue('DB_PASSWORD', '');

export const DB_DIALECT = envValue('DB_DIALECT', 'postgres');
export const DB_HOST = envValue('DB_HOST', '127.0.0.1');
export const DB_PORT = envValue('DB_PORT', DB_DIALECT === 'mysql' ? '3306' : '5432');
export const isPostgres = DB_DIALECT === 'postgres';

/**
 * The command-line client is rarely on PATH on Windows: PostgreSQL keeps it
 * under Program Files and XAMPP ships MySQL's own copy. PSQL_PATH or
 * MYSQL_PATH point at it directly.
 */
function findClient() {
  const candidates = isPostgres
    ? [
        process.env.PSQL_PATH,
        ...['18', '17', '16', '15', '14', '13'].map((v) => `C:/Program Files/PostgreSQL/${v}/bin/psql.exe`),
        '/usr/bin/psql', '/usr/local/bin/psql', '/opt/homebrew/bin/psql',
      ]
    : [
        process.env.MYSQL_PATH,
        'C:/xampp/mysql/bin/mysql.exe',
        '/usr/bin/mysql', '/usr/local/bin/mysql', '/opt/homebrew/bin/mysql',
      ];
  return candidates.filter(Boolean).find((c) => existsSync(c)) || (isPostgres ? 'psql' : 'mysql');
}
const CLIENT = findClient();

/**
 * Runs one SQL statement and returns the raw result: no header, columns
 * separated by tabs, which is what the suites expect from either client.
 */
export const sql = (query) => {
  const args = isPostgres
    ? ['--host', DB_HOST, '--port', String(DB_PORT), '--username', DB_USER, '--dbname', DB_NAME,
       '--no-align', '--tuples-only', '--field-separator', '	', '--no-password', '--command', query]
    : [`-u${DB_USER}`, ...(DB_PASSWORD ? [`-p${DB_PASSWORD}`] : []), '-N', DB_NAME, '-e', query];

  return execFileSync(CLIENT, args, {
    encoding: 'utf8',
    env: { ...process.env, ...(isPostgres && DB_PASSWORD ? { PGPASSWORD: DB_PASSWORD } : {}) },
  }).trim();
};

export const sqlNumber = (query) => Number(sql(query) || 0);

/** Quotes a camelCase column so PostgreSQL does not fold it to lowercase. */
export const col = (name) => (isPostgres ? `"${name}"` : `\`${name}\``);

/** Collects a column into one comma-separated string, in either dialect. */
export const idList = (expr = 'id') =>
  (isPostgres ? `COALESCE(STRING_AGG(${expr}::text, ','), '')` : `IFNULL(GROUP_CONCAT(${expr}), '')`);

/* ── HTTP ──────────────────────────────────────────────────────────── */

/**
 * One call to the API. `json` sends a JSON body, `form` sends FormData (for
 * uploads), `token` authenticates. Never throws on a non-2xx: the tests assert
 * on status codes, so a 403 is an answer, not an error.
 */
export async function call(method, path, { token, json, form, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (json) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  }
  if (form) init.body = form;

  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* plain text, e.g. a USSD reply */ }
  return {
    status: res.status,
    ok: res.ok,
    text,
    data,
    body: data?.data,
    message: data?.message,
    contentType: res.headers.get('content-type') || '',
  };
}

/** Posts form-encoded, the way a telecom gateway does. */
export async function postForm(path, fields, { secret } = {}) {
  const query = secret ? `?secret=${encodeURIComponent(secret)}` : '';
  const res = await fetch(`${API}${path}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get('content-type') || '' };
}

export const login = async (identifier, password) =>
  (await call('POST', '/auth/login', { json: { identifier, password } })).body;

export const adminLogin = async (identifier, password) =>
  (await call('POST', '/auth/admin/login', { json: { identifier, password } })).body;

/** The seeded logins every suite builds on. */
export const ACCOUNTS = {
  superAdmin: ['admin@agrimart.gh', 'Admin@2026'],
  admin: ['akua.boakye@agrimart.gh', 'Admin@2026'],
  farmer: ['farmer@agrimart.gh', 'Farmer@2026'],
  buyer: ['buyer@agrimart.gh', 'Buyer@2026'],
};

export const DEMO_USSD_PHONE = '0244100200';
export const DEMO_USSD_PIN = '1357';

/* ── Reporting ─────────────────────────────────────────────────────── */

const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  green: (s) => (colour ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (colour ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (colour ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (colour ? `\x1b[1m${s}\x1b[0m` : s),
};

/** A suite's own scoreboard. */
export function suite(title) {
  let passed = 0;
  const failures = [];

  console.log(`\n${c.bold(title)}`);

  const api = {
    section(name) {
      console.log(c.dim(`\n  ${name}`));
      return api;
    },
    check(name, condition, detail = '') {
      if (condition) {
        passed++;
        console.log(`  ${c.green('ok')}   ${name}`);
      } else {
        failures.push({ name, detail: String(detail) });
        console.log(`  ${c.red('FAIL')} ${name}${detail ? ` ${c.dim(`— ${detail}`)}` : ''}`);
      }
      return api;
    },
    /** Ends the suite: prints the tally and exits with the right code. */
    done() {
      const total = passed + failures.length;
      if (failures.length) {
        console.log(`\n  ${c.red(`${failures.length} of ${total} checks failed`)}`);
      } else {
        console.log(`\n  ${c.green(`${passed} checks passed`)}`);
      }
      process.exit(failures.length ? 1 : 0);
    },
  };
  return api;
}

/**
 * Removes rows a suite created, including the soft-deleted ones.
 *
 * Suites run often; anything they leave behind accumulates in the demo
 * database and eventually shows up in the console as a stranger's account.
 * Pass the names and phones the suite used — the order below respects the
 * foreign keys, so nothing is orphaned.
 */
export function cleanupTestRows({ names = [], phones = [], sessionPrefixes = [] } = {}) {
  const quoted = (list) => list.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
  const where = [];
  if (names.length) where.push(`${col('fullName')} IN (${quoted(names)})`);
  if (phones.length) where.push(`phone IN (${quoted(phones)})`);
  if (!where.length) return 0;

  const ids = sql(`SELECT ${idList()} FROM users WHERE ${where.join(' OR ')}`).trim();
  if (ids && ids !== 'NULL') {
    const listingIds = sql(`SELECT ${idList()} FROM listings WHERE ${col('farmerId')} IN (${ids})`).trim() || '0';
    sql(`DELETE FROM reviews WHERE ${col('reviewerId')} IN (${ids}) OR ${col('revieweeId')} IN (${ids})`);
    sql(`DELETE FROM transactions WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM support_tickets WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM offers WHERE ${col('buyerId')} IN (${ids}) OR ${col('farmerId')} IN (${ids}) OR ${col('listingId')} IN (${listingIds})`);
    sql(`DELETE FROM orders WHERE ${col('buyerId')} IN (${ids}) OR ${col('farmerId')} IN (${ids}) OR ${col('listingId')} IN (${listingIds})`);
    sql(`DELETE FROM favorites WHERE ${col('userId')} IN (${ids}) OR ${col('listingId')} IN (${listingIds})`);
    sql(`DELETE FROM listings WHERE ${col('farmerId')} IN (${ids})`);
    sql(`DELETE FROM price_alerts WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM notifications WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM messages WHERE ${col('senderId')} IN (${ids})`);
    sql(`DELETE FROM sms_messages WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM ussd_sessions WHERE ${col('userId')} IN (${ids})`);
    sql(`DELETE FROM audit_logs WHERE ${col('userId')} IN (${ids})`);
    names.forEach((name) => sql(`DELETE FROM audit_logs WHERE description LIKE '%${name.replace(/'/g, "''")}%'`));
    sql(`DELETE FROM users WHERE id IN (${ids})`);
  }
  phones.forEach((phone) => sql(`DELETE FROM sms_messages WHERE recipient='${phone}'`));
  sessionPrefixes.forEach((prefix) => sql(`DELETE FROM ussd_sessions WHERE ${col('sessionId')} LIKE '${prefix}%'`));
  return ids && ids !== 'NULL' ? ids.split(',').length : 0;
}

/** Stops with a clear message when the API is not running. */
export async function requireApi() {
  try {
    const res = await fetch(`${ORIGIN}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) return true;
  } catch { /* falls through */ }
  console.error(`\n  The API is not answering at ${ORIGIN}.`);
  console.error('  Start it in another terminal first:  npm run dev\n');
  process.exit(2);
}
