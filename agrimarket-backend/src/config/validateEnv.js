const env = require('./env');

/**
 * Production preflight.
 *
 * A development .env is full of conveniences — a blank database password, a
 * placeholder JWT secret, webhooks with no shared secret — and every one of
 * them is a hole once the platform is on the internet. Rather than trusting a
 * checklist, the server refuses to start in production until they are dealt
 * with, and names each one in plain language.
 *
 * Nothing here runs in development, so a laptop setup is untouched.
 */

const PLACEHOLDERS = [
  'change_me', 'changeme', 'secret', 'password', 'agrimarket_dev_secret',
  'agrimarket_dev_refresh', 'your_secret_here', 'xxx', 'todo',
];

const isPlaceholder = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return !v || PLACEHOLDERS.includes(v) || v.length < 32;
};

const isLocal = (url) => /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(String(url || ''));

function collect() {
  const errors = [];
  const warnings = [];
  const fail = (what, why) => errors.push({ what, why });
  const warn = (what, why) => warnings.push({ what, why });

  // ── Session secrets ────────────────────────────────────────────────
  if (isPlaceholder(process.env.JWT_SECRET)) {
    fail('JWT_SECRET', 'must be a random string of at least 32 characters. Anyone who guesses it can sign in as any user. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  }
  if (isPlaceholder(process.env.JWT_REFRESH_SECRET)) {
    fail('JWT_REFRESH_SECRET', 'must be a different random string of at least 32 characters');
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    fail('JWT_REFRESH_SECRET', 'must not be the same value as JWT_SECRET');
  }

  // ── Database ───────────────────────────────────────────────────────
  /**
   * A hosted database hands you one connection string, and the credentials
   * live inside it — DB_USER and DB_PASSWORD are never read. Checking them
   * there would demand values the deployment does not have.
   */
  if (env.db.url) {
    let parsed = null;
    try {
      parsed = new URL(env.db.url);
    } catch {
      fail('DATABASE_URL', 'is not a valid connection string');
    }
    if (parsed) {
      if (!parsed.password) {
        fail('DATABASE_URL', 'has no password in it. Copy the full connection string your database provider gave you');
      }
      if (isLocal(parsed.hostname)) {
        warn('DATABASE_URL', 'points at localhost, which a hosted server cannot reach');
      }
      const encrypted = env.db.ssl || /sslmode=(require|verify-full|verify-ca)/.test(env.db.url);
      if (!encrypted && !isLocal(parsed.hostname)) {
        fail('DATABASE_URL', 'reaches a remote database without TLS. Add ?sslmode=require, or set DB_SSL=true');
      }
    }
  } else {
    if (!process.env.DB_PASSWORD) {
      fail('DB_PASSWORD', 'is empty. Give the database user a password and do not use root in production');
    }
    if (String(process.env.DB_USER || 'root') === 'root') {
      warn('DB_USER', 'is root. Create a user that can only reach the AgriMart database');
    }
  }
  if (process.env.DB_SYNC_ALTER === 'true') {
    fail('DB_SYNC_ALTER', 'must not be true in production — it lets the server rewrite live tables on boot');
  }

  // ── Public addresses ───────────────────────────────────────────────
  if (!process.env.CLIENT_URL || isLocal(process.env.CLIENT_URL)) {
    fail('CLIENT_URL', 'must be the website\'s real address (e.g. https://agrimart.gh). CORS and every link in an SMS depend on it');
  }
  if (!process.env.APP_URL || isLocal(process.env.APP_URL)) {
    fail('APP_URL', 'must be the API\'s real address (e.g. https://api.agrimart.gh)');
  }
  [['CLIENT_URL', process.env.CLIENT_URL], ['APP_URL', process.env.APP_URL], ['PUBLIC_URL', process.env.PUBLIC_URL]]
    .forEach(([key, value]) => {
      if (value && !isLocal(value) && !value.startsWith('https://')) {
        warn(key, 'is not https. Passwords and session tokens would travel in the clear');
      }
    });

  // ── Gateway webhooks ───────────────────────────────────────────────
  if (!process.env.GATEWAY_SECRET || String(process.env.GATEWAY_SECRET).length < 12) {
    fail('GATEWAY_SECRET', 'must be set (12+ characters) and added to the callback URLs in the gateway dashboard as ?secret=… — without it anyone can post fake USSD sessions and inbound SMS to this server');
  }

  // ── Accounts ───────────────────────────────────────────────────────
  if (!process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD === 'Admin@2026') {
    fail('SEED_ADMIN_PASSWORD', 'is still the documented demo password. Change it before the console is reachable');
  }
  if (env.bcryptRounds < 10) {
    fail('BCRYPT_ROUNDS', 'must be at least 10');
  }

  // ── SMS and USSD ───────────────────────────────────────────────────
  if (env.sms.provider === 'mock') {
    warn('SMS_PROVIDER', 'is "mock" — messages are recorded in the SMS centre but never delivered to farmers');
  }
  if (env.sms.provider === 'africastalking' && !env.sms.africastalking.apiKey) {
    fail('AT_API_KEY', 'is empty but SMS_PROVIDER is africastalking');
  }
  if (env.sms.provider === 'africastalking' && env.sms.africastalking.sandbox) {
    fail('AT_USERNAME', 'is still the sandbox. Use your live application username so farmers actually receive their SMS');
  }
  if (env.sms.allowlist.length) {
    warn('SMS_ALLOWLIST', `is set, so only ${env.sms.allowlist.length} number(s) will ever receive a real SMS. Clear it once you are live`);
  }
  if (!env.ussd.serviceCode || env.ussd.serviceCode === '*920*1234#') {
    warn('USSD_SERVICE_CODE', 'is still the placeholder. Set your own code, in quotes, or every screen will tell farmers the wrong number to dial');
  }

  return { errors, warnings };
}

/**
 * Prints what is wrong and stops the boot when anything is fatal.
 * Returns the findings so a script can reuse the same checks.
 */
function validateEnv({ exitOnError = true, silent = false } = {}) {
  if (!env.isProd) return { errors: [], warnings: [], skipped: true };

  const { errors, warnings } = collect();

  if (!silent && warnings.length) {
    console.log('\n\x1b[33m  Production warnings\x1b[0m');
    warnings.forEach(({ what, why }) => console.log(`   • ${what} ${why}`));
  }

  if (errors.length) {
    if (!silent) {
      console.log('\n\x1b[31m┌──────────────────────────────────────────────────────────┐\x1b[0m');
      console.log('\x1b[31m│\x1b[0m  \x1b[1mThis server is not ready for production\x1b[0m                 \x1b[31m│\x1b[0m');
      console.log('\x1b[31m└──────────────────────────────────────────────────────────┘\x1b[0m');
      errors.forEach(({ what, why }, i) => console.log(`  ${i + 1}. \x1b[1m${what}\x1b[0m ${why}`));
      // On a hosted platform there is no .env to edit — the values come from
      // the dashboard, and sending someone to a file that does not exist wastes
      // the one minute they have while the service is down.
      const hosted = !!(process.env.RENDER || process.env.DYNO || process.env.FLY_APP_NAME
        || process.env.KOYEB_APP_NAME || process.env.RAILWAY_ENVIRONMENT || env.db.url);
      console.log(hosted
        ? '\n  Set these in your host\'s environment variables, then redeploy.'
        : '\n  Fix these in agrimarket-backend/.env and start again.');
      console.log('  To check without starting the server:  npm run check:env\n');
    }
    if (exitOnError) process.exit(1);
  } else if (!silent) {
    console.log('\x1b[32m  Production configuration checks passed\x1b[0m');
  }

  return { errors, warnings, skipped: false };
}

module.exports = { validateEnv, collect, isPlaceholder, isLocal };
