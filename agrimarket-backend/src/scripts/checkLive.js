/**
 * Read-only go-live audit of whatever database this .env points at.
 *
 *   npm run check:live
 *
 * Nothing is changed. It answers the questions you would otherwise only find
 * out from a customer: can anyone still sign in with a password from the
 * README, is the support line on the website a placeholder, will SMS actually
 * leave the building, and is the gateway pointed at this server.
 */
const env = require('../config/env');
const { connectDatabase, sequelize } = require('../config/database');
const { User, Setting, Listing, Order, SmsMessage, Produce, Op } = require('../models');
const settingsService = require('../services/settingsService');
const { LIKE } = require('../utils/search');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const blockers = [];
const warnings = [];
const notes = [];

/** Demo logins published in the README — every one of them must be gone or changed. */
const DEMO_LOGINS = [
  ['admin@agrimart.gh', 'Admin@2026'],
  ['akua.boakye@agrimart.gh', 'Admin@2026'],
  ['agent.techiman@agrimart.gh', 'Agent@2026'],
  ['agent.tamale@agrimart.gh', 'Agent@2026'],
  ['farmer@agrimart.gh', 'Farmer@2026'],
  ['buyer@agrimart.gh', 'Buyer@2026'],
];

(async () => {
  console.log(`\n${bold('AgriMart — go-live audit')}`);
  console.log(`  ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}  (${env.nodeEnv})\n`);

  await connectDatabase();
  await settingsService.load();

  // ── 1. Credentials anyone could read in the documentation ──────────
  for (const [email, password] of DEMO_LOGINS) {
    const user = await User.scope('withSecrets').findOne({ where: { email }, paranoid: false });
    if (!user || user.deletedAt) continue;
    const stillWorks = await user.comparePassword(password).catch(() => false);
    if (stillWorks) {
      blockers.push(`${email} still signs in with the password from the README. Change it or remove the account.`);
    } else {
      notes.push(`${email} exists but its documented password no longer works.`);
    }
  }

  const demoPins = await User.scope('withSecrets').findAll({
    where: { pin: { [Op.ne]: null }, status: 'active' },
    limit: 500,
  });
  let sharedPins = 0;
  for (const u of demoPins) {
    if ((await u.comparePin?.('1357').catch(() => false)) || (await u.comparePin?.('2468').catch(() => false))) sharedPins++;
  }
  if (sharedPins > 1) {
    warnings.push(`${sharedPins} accounts use a published demo USSD PIN (1357 / 2468). Fine for the demo account, a risk for anyone real.`);
  }

  // ── 2. What the public actually sees ───────────────────────────────
  const settingChecks = [
    ['support_phone', ['0302000000', '0302 000 000', ''], 'the support line on every page and in every SMS'],
    ['support_email', ['support@agrimart.gh', ''], 'the support email address'],
    ['ussd_code', ['*920*1234#', ''], 'the USSD code printed across the site'],
    ['platform_name', [''], 'the platform name'],
    ['office_address', [''], 'the office address on the contact page'],
  ];
  settingChecks.forEach(([key, placeholders, what]) => {
    const value = String(settingsService.get(key) ?? '').trim();
    if (placeholders.includes(value)) {
      warnings.push(`Settings → ${key} is still "${value || 'empty'}" — that is ${what}.`);
    }
  });

  if (settingsService.get('maintenance_mode') === true) {
    blockers.push('Settings → maintenance_mode is ON. USSD callers get a "come back later" message.');
  }
  if (settingsService.get('registration_open') === false) {
    warnings.push('Settings → registration_open is OFF, so nobody new can join.');
  }

  // ── 3. Will messages reach farmers ─────────────────────────────────
  if (env.sms.provider === 'mock') {
    blockers.push('SMS_PROVIDER is "mock": messages are recorded but never delivered.');
  }
  if (env.sms.allowlist.length) {
    blockers.push(`SMS_ALLOWLIST still limits delivery to ${env.sms.allowlist.join(', ')}. Everyone else is silently skipped.`);
  }
  const failed = await SmsMessage.count({ where: { status: 'failed' } });
  const sent = await SmsMessage.count({ where: { status: ['sent', 'delivered'] } });
  if (failed > sent && failed > 5) {
    warnings.push(`${failed} SMS have failed against ${sent} delivered — check the gateway balance and sender ID.`);
  }
  notes.push(`SMS centre: ${sent} delivered, ${failed} failed, provider "${env.sms.provider}".`);

  // ── 4. Is the platform actually usable on day one ──────────────────
  const produce = await Produce.count();
  const withPhoto = await Produce.count({ where: { imageUrl: { [Op.ne]: null } } });
  if (!produce) blockers.push('No produce types in the catalogue — a farmer cannot list anything.');
  else if (withPhoto < produce) warnings.push(`${produce - withPhoto} of ${produce} produce types have no catalogue photo. Run npm run photos:sync.`);

  const settingsRows = await Setting.count();
  if (!settingsRows) blockers.push('The settings table is empty — the console has nothing to edit.');

  const admins = await User.count({ where: { role: ['admin', 'superadmin'], status: 'active' } });
  const supers = await User.count({ where: { role: 'superadmin', status: 'active' } });
  if (!supers) blockers.push('There is no active super administrator.');
  notes.push(`${admins} active administrator(s), ${supers} of them super administrator(s).`);

  // ── 5. Demo trade left in the shop window ──────────────────────────
  const listings = await Listing.count();
  const orders = await Order.count();
  const demoSellers = await User.count({ where: { email: { [LIKE]: '%@example.gh' } } });
  if (demoSellers) {
    warnings.push(`${demoSellers} seeded demo accounts (@example.gh) are still in the database, with their listings and orders.`);
  }
  notes.push(`${listings} listings and ${orders} orders currently in the database.`);

  // ── 6. Will uploaded photos survive a deploy ───────────────────────
  const storage = require('../services/storageService').check();
  if (!storage.ok) {
    blockers.push(`Uploads are set to object storage but ${storage.detail}. Photos and dispute evidence would fail to save.`);
  } else if (storage.driver === 'local' && env.isProd) {
    warnings.push(
      'Uploads go to local disk. On a hosted platform the disk is wiped on every deploy, taking listing photos, ' +
      'avatars and payment-dispute screenshots with it. Set STORAGE_DRIVER=supabase on that kind of host.'
    );
  }
  notes.push(`Uploads: ${storage.detail}.`);

  // ── 7. Can the gateway reach this server ───────────────────────────
  if (!env.gatewaySecret) {
    blockers.push('GATEWAY_SECRET is empty: anyone who finds the URL can post fake USSD sessions and inbound SMS.');
  }
  if (/localhost|127\.0\.0\.1/.test(env.publicUrl)) {
    blockers.push(`PUBLIC_URL is ${env.publicUrl} — Africa's Talking cannot reach that. Use the API's public https address.`);
  }
  notes.push(`Gateway callbacks should point at ${env.publicUrl}${env.apiPrefix}/ussd and ${env.publicUrl}${env.apiPrefix}/sms/inbound`);

  // ── Report ─────────────────────────────────────────────────────────
  console.log(bold('  Blockers'));
  if (!blockers.length) console.log(`    ${green('none')}`);
  blockers.forEach((b, i) => console.log(`    ${red(`${i + 1}.`)} ${b}`));

  console.log(`\n${bold('  Worth fixing')}`);
  if (!warnings.length) console.log(`    ${green('none')}`);
  warnings.forEach((w, i) => console.log(`    ${yellow(`${i + 1}.`)} ${w}`));

  console.log(`\n${bold('  For the record')}`);
  notes.forEach((n) => console.log(`    • ${n}`));

  console.log(
    blockers.length
      ? `\n  ${red(`${blockers.length} blocker(s) — not ready to go live.`)}\n`
      : `\n  ${green('No blockers found.')}\n`
  );

  await sequelize.close();
  process.exit(blockers.length ? 1 : 0);
})().catch((err) => {
  console.error(red(`\n  Audit failed: ${err.message}\n`));
  process.exit(1);
});
