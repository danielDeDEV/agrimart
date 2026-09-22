require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  appName: process.env.APP_NAME || 'AgriMart Ghana',
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    // 5432 for PostgreSQL, 3306 for MySQL — follows the dialect unless set
    port: parseInt(process.env.DB_PORT, 10) || ((process.env.DB_DIALECT || 'postgres') === 'mysql' ? 3306 : 5432),
    name: process.env.DB_NAME || 'agrimarket',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    /**
     * Hosted Postgres (Neon, Supabase, Render and the rest) only accepts TLS
     * connections, and most present a certificate this client cannot verify
     * against a local root store. DB_SSL=true turns TLS on; set
     * DB_SSL_REJECT_UNAUTHORIZED=true once you have the provider's CA.
     */
    ssl: process.env.DB_SSL === 'true' || /sslmode=require/.test(process.env.DATABASE_URL || ''),
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    /** A single connection string takes precedence, which is how most hosts hand it to you. */
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'agrimarket_dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'agrimarket_dev_refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,

  ussd: {
    serviceCode: process.env.USSD_SERVICE_CODE || '*920*1234#',
    sessionTimeout: parseInt(process.env.USSD_SESSION_TIMEOUT, 10) || 180,
    provider: process.env.USSD_PROVIDER || 'africastalking',
  },

  /**
   * Where Africa's Talking reaches this server. On a laptop it is the ngrok
   * URL; in production the API's own domain. Only used to print and display
   * the exact callback URLs to paste into the AT dashboard.
   */
  publicUrl: (process.env.PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, ''),
  gatewaySecret: process.env.GATEWAY_SECRET || '',

  sms: {
    provider: (process.env.SMS_PROVIDER || 'mock').toLowerCase(),
    // Empty on purpose = send without a sender ID, which is what you need until
    // the gateway approves one. A missing line falls back to the app name.
    senderId: process.env.SMS_SENDER_ID ?? 'AgriMart',
    shortCode: process.env.SMS_SHORT_CODE || process.env.AT_SHORT_CODE || '',
    enabled: process.env.SMS_ENABLED !== 'false',
    // Safe mode: when set, a real gateway only texts these numbers and every
    // other message is logged as skipped. Keeps demo accounts off the bill.
    allowlist: (process.env.SMS_ALLOWLIST || '').split(/[\s,;]+/).filter(Boolean),
    africastalking: {
      apiKey: process.env.AT_API_KEY || '',
      username: process.env.AT_USERNAME || 'sandbox',
      // Sandbox numbers only work with the sandbox host and the AT simulator
      sandbox: process.env.AT_SANDBOX === 'true' || (process.env.AT_USERNAME || 'sandbox') === 'sandbox',
      // Short code farmers text (AT calls it the "alphanumeric or short code")
      shortCode: process.env.AT_SHORT_CODE || process.env.SMS_SHORT_CODE || '',
    },
    hubtel: {
      clientId: process.env.HUBTEL_CLIENT_ID || '',
      clientSecret: process.env.HUBTEL_CLIENT_SECRET || '',
    },
    mnotify: { apiKey: process.env.MNOTIFY_API_KEY || '' },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
  },

  platform: {
    commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.03,
    currency: process.env.DEFAULT_CURRENCY || 'GHS',
    countryCode: process.env.COUNTRY_CODE || '233',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@agrimart.gh',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@2026',
    adminPhone: process.env.SEED_ADMIN_PHONE || '0244000000',
  },
};

env.isProd = env.nodeEnv === 'production';
env.isDev = !env.isProd;

module.exports = env;
