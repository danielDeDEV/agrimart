const env = require('./env');

/**
 * The browser origins allowed to reach this server — for both the REST API and
 * the realtime gateway, so the two can never drift apart.
 *
 * CLIENT_URL is the website. CLIENT_URLS adds any others (the bare domain, a
 * staging site) as a comma-separated list. The local ports are added in
 * development only, so a production server never trusts localhost.
 */
const allowedOrigins = [
  env.clientUrl,
  ...(process.env.CLIENT_URLS || '').split(/[\s,;]+/).filter(Boolean),
  ...(env.isDev ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'] : []),
]
  .filter(Boolean)
  .map((url) => url.replace(/\/$/, ''));

const isAllowedOrigin = (origin) => allowedOrigins.includes(String(origin || '').replace(/\/$/, ''));

module.exports = { allowedOrigins, isAllowedOrigin };
