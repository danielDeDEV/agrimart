/**
 * Runs every suite in this folder against a running API.
 *
 *   npm test                  all suites
 *   npm test -- ussd team     only the suites whose name matches
 *
 * Each suite is a separate process, so one crash cannot take the rest with it.
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TESTS_DIR, ORIGIN, DB_NAME, requireApi, sqlNumber } from './helpers.mjs';

const filters = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const suites = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .filter((f) => !filters.length || filters.some((needle) => f.includes(needle)))
  .sort();

if (!suites.length) {
  console.error(`No suites matched: ${filters.join(', ')}`);
  process.exit(1);
}

console.log(`\n\x1b[1mAgriMart tests\x1b[0m`);
console.log(`  api: ${ORIGIN}   database: ${DB_NAME}`);
console.log(`  ${suites.length} suite(s): ${suites.map((s) => s.replace('.test.mjs', '')).join(', ')}`);

await requireApi();

/**
 * These suites sign in as the seeded demo accounts and trade with them, so
 * they only work against a demo database. A live database has had that data
 * removed — say so plainly rather than letting seven suites fail one by one.
 */
const demoAccounts = sqlNumber(
  "SELECT COUNT(*) AS n FROM users WHERE email IN ('farmer@agrimart.gh','buyer@agrimart.gh','akua.boakye@agrimart.gh')"
);
if (demoAccounts < 3) {
  console.error([
    '',
    '  [33mThis database has no demo data, so the tests cannot run against it.[0m',
    '',
    '  That is expected on a live database: "npm run purge:demo" removed the',
    '  accounts these suites trade with. Keep the two apart:',
    '',
    '    live    the database real farmers use — never run tests against it',
    '    demo    a separate database for development and testing',
    '',
    '  To make a demo database on this machine, point DB_NAME at a new name in',
    '  .env (for example agrimarket_demo), run "npm run setup", start the API',
    '  against it, and run the tests again.',
    '',
  ].join('\n'));
  process.exitCode = 2;
} else {

const started = Date.now();
const results = [];

for (const file of suites) {
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(TESTS_DIR, file)], { stdio: 'inherit' });
    child.on('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  results.push({ file, code });
}

const failed = results.filter((r) => r.code !== 0);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\n${'─'.repeat(52)}`);
results.forEach(({ file, code }) => {
  const name = file.replace('.test.mjs', '');
  console.log(`  ${code === 0 ? '\x1b[32mpass\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}`);
});

if (failed.length) {
  console.log(`\n  \x1b[31m${failed.length} of ${results.length} suites failed\x1b[0m  (${seconds}s)\n`);
  process.exit(1);
}
console.log(`\n  \x1b[32mAll ${results.length} suites passed\x1b[0m  (${seconds}s)\n`);
}
