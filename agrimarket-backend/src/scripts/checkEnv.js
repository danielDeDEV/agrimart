/**
 * Runs the production configuration checks without starting the server, so a
 * deploy can be verified before it takes traffic:
 *
 *   NODE_ENV=production npm run check:env
 *
 * Exits 0 when the configuration is safe to go live, 1 when it is not.
 */
const env = require('../config/env');
const { collect } = require('../config/validateEnv');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(`\n${bold('AgriMart — configuration check')}`);
console.log(`  environment: ${env.nodeEnv}`);
console.log(`  api:         ${env.appUrl}`);
console.log(`  website:     ${env.clientUrl}`);
console.log(`  database:    ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}`);
console.log(`  sms:         ${env.sms.provider}${env.sms.senderId ? ` as "${env.sms.senderId}"` : ' (no sender ID)'}`);
console.log(`  ussd:        ${env.ussd.serviceCode}\n`);

if (!env.isProd) {
  console.log(yellow('  These checks only apply to production.'));
  console.log('  To see what a live deploy would be told, run:');
  console.log('    NODE_ENV=production npm run check:env\n');
  process.exit(0);
}

const { errors, warnings } = collect();

warnings.forEach(({ what, why }) => console.log(`  ${yellow('warning')}  ${bold(what)} ${why}`));
if (warnings.length) console.log('');

if (!errors.length) {
  console.log(green('  Ready for production.\n'));
  process.exit(0);
}

errors.forEach(({ what, why }, i) => console.log(`  ${red(`${i + 1}.`)} ${bold(what)} ${why}`));
console.log(`\n  ${red(`${errors.length} problem(s) must be fixed before going live.`)}\n`);
process.exit(1);
