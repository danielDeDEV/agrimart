/**
 * Clears the demonstration data out of a database so real farmers can use it.
 *
 *   npm run purge:demo                 show what would go (changes nothing)
 *   npm run purge:demo -- --apply      do it, after typing the database name
 *   npm run purge:demo -- --prices     also clear the seeded market prices
 *   npm run purge:demo -- --keep 5,12  keep these account ids as well
 *   npm run purge:demo -- --also 66,72  remove these accounts too (your own
 *                                       test accounts, which the seeder did
 *                                       not create and so cannot recognise)
 *
 * What always survives: the reference data the platform cannot run without —
 * regions, districts, markets, categories, produce types, farm guides — and
 * everything in Admin → Settings, so the support line, USSD code and platform
 * name you have already set stay exactly as they are.
 *
 * What goes: every seeded account and everything it owns — listings, orders,
 * offers, transactions, reviews, messages, impact records, support tickets —
 * plus the SMS log, USSD sessions and audit trail those accounts generated.
 *
 * Your own administrator accounts are kept. Run a backup first; this cannot be
 * undone:  npm run backup
 */
const readline = require('readline');
const env = require('../config/env');
const { connectDatabase, sequelize, isPostgres } = require('../config/database');
const logger = require('../utils/logger');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const purgePrices = args.includes('--prices');
const idsFrom = (flag) =>
  (args.includes(flag) ? args[args.indexOf(flag) + 1] || '' : '')
    .split(/[\s,]+/)
    .map((n) => parseInt(n, 10))
    .filter(Number.isInteger);

const keepIds = idsFrom('--keep');
/** Accounts you made yourself while testing: named explicitly, never guessed. */
const alsoIds = idsFrom('--also');

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

/** Quotes a camelCase column so PostgreSQL does not fold it to lowercase. */
const c = (name) => (isPostgres ? `"${name}"` : `\`${name}\``);
/** Joins a set of ids into one comma-separated string, whatever the dialect. */
const idsOf = (expr) => (isPostgres
  ? `COALESCE(STRING_AGG(${expr}::text, ','), '0')`
  : `IFNULL(GROUP_CONCAT(${expr}), '0')`);

const one = async (sql, replacements) => {
  const [rows] = await sequelize.query(sql, { replacements });
  return rows;
};
const count = async (sql, replacements) => Number((await one(sql, replacements))[0]?.n ?? 0);

(async () => {
  console.log(`\n${bold('AgriMart — clearing the demonstration data')}`);
  console.log(`  ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}\n`);

  await connectDatabase();

  /**
   * A demo account is one the seeder created. They are marked in three ways:
   * the staff and agents carry registrationChannel 'seed', the demo buyers use
   * @example.gh addresses, and the documented logins use @agrimart.gh. Anything
   * else — the accounts you made in the console, and every farmer who signs up
   * from now on — is left alone.
   */
  const keepClause = keepIds.length ? `AND id NOT IN (${keepIds.join(',')})` : '';
  const alsoClause = alsoIds.length ? `OR id IN (${alsoIds.join(',')})` : '';
  const demoWhere = `
    ((${c('registrationChannel')} = 'seed'
      OR email LIKE '%@example.gh'
      OR email LIKE '%@agrimart.gh'
      OR (role IN ('farmer', 'buyer') AND ${c('createdAt')} < (SELECT MIN(${c('createdAt')}) FROM settings))
      ${alsoClause}))
    AND role <> 'superadmin'
    ${keepClause}
  `;

  const demo = await one(`SELECT id, ${c('fullName')}, email, phone, role FROM users WHERE ${demoWhere} ORDER BY role, id`);
  const survivors = await one(
    `SELECT id, ${c('fullName')}, email, phone, role FROM users WHERE NOT (${demoWhere}) ORDER BY CASE role
       WHEN 'superadmin' THEN 1 WHEN 'admin' THEN 2 WHEN 'agent' THEN 3
       WHEN 'farmer' THEN 4 WHEN 'buyer' THEN 5 ELSE 6 END, id`
  );

  const ids = demo.map((u) => u.id);
  const idList = ids.length ? ids.join(',') : '0';
  const listingIds = (await one(`SELECT ${idsOf('id')} AS ids FROM listings WHERE ${c('farmerId')} IN (${idList})`))[0].ids;

  const tally = {
    'demo accounts': demo.length,
    listings: await count(`SELECT COUNT(*) n FROM listings WHERE ${c('farmerId')} IN (${idList})`),
    orders: await count(`SELECT COUNT(*) n FROM orders WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList})`),
    offers: await count(`SELECT COUNT(*) n FROM offers WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList})`),
    transactions: await count(`SELECT COUNT(*) n FROM transactions WHERE ${c('userId')} IN (${idList})`),
    reviews: await count(`SELECT COUNT(*) n FROM reviews WHERE ${c('reviewerId')} IN (${idList}) OR ${c('revieweeId')} IN (${idList})`),
    'impact records': await count(`SELECT COUNT(*) n FROM impact_records WHERE ${c('userId')} IN (${idList})`),
    'support tickets': await count('SELECT COUNT(*) n FROM support_tickets'),
    'SMS log': await count('SELECT COUNT(*) n FROM sms_messages'),
    'USSD sessions': await count('SELECT COUNT(*) n FROM ussd_sessions'),
    'audit log': await count('SELECT COUNT(*) n FROM audit_logs'),
    notifications: await count('SELECT COUNT(*) n FROM notifications'),
    'price alerts': await count(`SELECT COUNT(*) n FROM price_alerts WHERE ${c('userId')} IN (${idList})`),
    favourites: await count(`SELECT COUNT(*) n FROM favorites WHERE ${c('userId')} IN (${idList})`),
  };
  if (purgePrices) tally['market prices'] = await count('SELECT COUNT(*) n FROM market_prices');

  const kept = {
    regions: await count('SELECT COUNT(*) n FROM regions'),
    districts: await count('SELECT COUNT(*) n FROM districts'),
    markets: await count('SELECT COUNT(*) n FROM markets'),
    categories: await count('SELECT COUNT(*) n FROM categories'),
    'produce types': await count('SELECT COUNT(*) n FROM produces'),
    'farm guides': await count('SELECT COUNT(*) n FROM farming_tips'),
    settings: await count('SELECT COUNT(*) n FROM settings'),
  };
  if (!purgePrices) kept['market prices'] = await count('SELECT COUNT(*) n FROM market_prices');

  console.log(bold('  Will be removed'));
  Object.entries(tally).forEach(([label, n]) => {
    if (n) console.log(`    ${red('−')} ${String(n).padStart(6)}  ${label}`);
  });

  console.log(`\n${bold('  Will be kept')}`);
  Object.entries(kept).forEach(([label, n]) => console.log(`    ${green('+')} ${String(n).padStart(6)}  ${label}`));

  console.log(`\n${bold('  Accounts that stay')}`);
  survivors.forEach((u) =>
    console.log(`    ${green('+')} ${String(u.id).padStart(4)}  ${u.fullName} ${dim(`(${u.role}, ${u.email || u.phone})`)}`)
  );
  if (demo.length) {
    console.log(`\n${bold('  Accounts that go')} ${dim(`(${demo.length})`)}`);
    demo.slice(0, 8).forEach((u) =>
      console.log(`    ${red('−')} ${String(u.id).padStart(4)}  ${u.fullName} ${dim(`(${u.role}, ${u.email || u.phone})`)}`)
    );
    if (demo.length > 8) console.log(dim(`       … and ${demo.length - 8} more`));
  }

  if (!purgePrices && kept['market prices']) {
    console.log(`\n  ${dim(`The ${kept['market prices'].toLocaleString()} market prices are seeded figures, kept at your request.`)}`);
    console.log(`  ${dim('Clear them with: npm run purge:demo -- --apply --prices')}`);
  }

  if (!apply) {
    console.log(`\n  Nothing was changed. To do it:  ${bold('npm run purge:demo -- --apply')}`);
    console.log(`  Back up first:                  ${bold('npm run backup')}\n`);
    await sequelize.close();
    process.exit(0);
  }

  const typed = await ask(`\n  ${red('This cannot be undone.')} Type the database name "${env.db.name}" to continue: `);
  if (typed !== env.db.name) {
    console.log('\n  Cancelled — nothing was changed.\n');
    await sequelize.close();
    process.exit(1);
  }

  console.log('');
  const run = async (label, sql) => {
    const [, result] = await sequelize.query(sql);
    logger.info(`${label} — ${result?.affectedRows ?? 0} row(s)`);
  };

  // Children first: the foreign keys mean nothing may be orphaned
  await run('Reviews', `DELETE FROM reviews WHERE ${c('reviewerId')} IN (${idList}) OR ${c('revieweeId')} IN (${idList}) OR ${c('orderId')} IN (SELECT id FROM orders WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList}))`);
  await run('Transactions', `DELETE FROM transactions WHERE ${c('userId')} IN (${idList}) OR ${c('orderId')} IN (SELECT id FROM orders WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList}))`);
  await run('Support tickets', 'DELETE FROM support_tickets');
  await run('Messages', `DELETE FROM messages WHERE ${c('senderId')} IN (${idList})`);
  await run('Conversations', `DELETE FROM conversations WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList})`);
  await run('Orders', `DELETE FROM orders WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList}) OR ${c('listingId')} IN (${listingIds})`);
  await run('Offers', `DELETE FROM offers WHERE ${c('buyerId')} IN (${idList}) OR ${c('farmerId')} IN (${idList}) OR ${c('listingId')} IN (${listingIds})`);
  await run('Favourites', `DELETE FROM favorites WHERE ${c('userId')} IN (${idList}) OR ${c('listingId')} IN (${listingIds})`);
  await run('Listings', `DELETE FROM listings WHERE ${c('farmerId')} IN (${idList})`);
  await run('Impact records', `DELETE FROM impact_records WHERE ${c('userId')} IN (${idList}) OR ${c('collectedBy')} IN (${idList})`);
  await run('Price alerts', `DELETE FROM price_alerts WHERE ${c('userId')} IN (${idList})`);
  await run('Notifications', 'DELETE FROM notifications');
  await run('SMS log', 'DELETE FROM sms_messages');
  await run('Broadcasts', 'DELETE FROM broadcasts');
  await run('USSD sessions', 'DELETE FROM ussd_sessions');
  await run('One-time passwords', 'DELETE FROM otps');
  await run('Audit log', 'DELETE FROM audit_logs');
  if (purgePrices) await run('Market prices', 'DELETE FROM market_prices');
  // Seeded prices are attributed to the field agents being removed
  await run('Price attribution', `UPDATE market_prices SET ${c('recordedBy')} = NULL WHERE ${c('recordedBy')} IN (${idList})`);
  await run('Guide authorship', `UPDATE farming_tips SET ${c('createdBy')} = NULL WHERE ${c('createdBy')} IN (${idList})`);
  await run('Demo accounts', `DELETE FROM users WHERE id IN (${idList})`);

  const left = await count('SELECT COUNT(*) n FROM users');
  const listingsLeft = await count('SELECT COUNT(*) n FROM listings');
  const pricesLeft = await count('SELECT COUNT(*) n FROM market_prices');

  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  The platform is ready for real people                    │
  ├──────────────────────────────────────────────────────────┤
  │  Accounts       ${String(left).padEnd(41)}│
  │  Listings       ${String(listingsLeft).padEnd(41)}│
  │  Market prices  ${String(pricesLeft).padEnd(41)}│
  └──────────────────────────────────────────────────────────┘

  Next:
    1. Change the super administrator password in the console
    2. Clear SMS_ALLOWLIST in .env so every farmer receives messages
    3. Set GATEWAY_SECRET and add ?secret=… to the gateway callbacks
    4. npm run check:live
`);

  await sequelize.close();
  process.exit(0);
})().catch(async (err) => {
  logger.error('Purge failed:', err.message);
  console.error(err.stack?.split('\n').slice(1, 4).join('\n'));
  await sequelize.close().catch(() => {});
  process.exit(1);
});
