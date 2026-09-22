const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const env = require('./config/env');
const logger = require('./utils/logger');
const { isAllowedOrigin } = require('./config/origins');
const routes = require('./routes');
const limiter = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // Images and uploads are served to a Next.js app on another origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// Browsers may call this API from the website and nowhere else
const reportedOrigins = new Set();

app.use(
  cors({
    origin(origin, callback) {
      // Server-to-server calls (USSD/SMS gateways, curl) send no Origin header
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Refuse by withholding the CORS headers rather than raising a 500: the
      // browser blocks the call and the log names the origin to add if it is ours
      if (!reportedOrigins.has(origin)) {
        reportedOrigins.add(origin);
        logger.warn(`Blocked a browser call from ${origin}. Add it to CLIENT_URLS if it belongs to you.`);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.use(compression());
app.use(express.json({ limit: '2mb' }));
// USSD and SMS aggregators post application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (env.isDev) {
  app.use(morgan('dev', { skip: (req) => req.originalUrl === '/health' }));
} else {
  // Gateway callbacks carry ?secret=… — keep it out of the access log, and do
  // not fill the log with the uptime monitor's health checks.
  morgan.token('url', (req) => String(req.originalUrl || req.url).replace(/([?&](secret|token)=)[^&]*/gi, '$1[redacted]'));
  app.use(morgan('combined', { skip: (req) => req.originalUrl.startsWith('/health') }));
}

/**
 * Uploaded photos. Resolved from this file rather than the working directory,
 * so the service runs the same under pm2, systemd or a scheduled task.
 */
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', fallthrough: true, index: false }));

/**
 * Liveness: is the process up? Used by a load balancer to decide whether to
 * keep sending traffic, so it stays cheap and never touches the database.
 */
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: env.appName,
    environment: env.nodeEnv,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);

/** Readiness: can the API actually serve? Checks the database round-trip. */
app.get('/health/ready', async (_req, res) => {
  const started = Date.now();
  try {
    const { sequelize } = require('./config/database');
    await sequelize.authenticate();
    res.json({ status: 'ready', database: 'up', latencyMs: Date.now() - started });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', database: 'down', error: err.message });
  }
});

app.get('/docs', (_req, res) => res.redirect(`${env.apiPrefix}`));

app.use(limiter.general);
app.use(env.apiPrefix, routes);

// Friendly root so opening http://localhost:5000 in a browser explains itself
app.get('/', (_req, res) =>
  res.json({
    success: true,
    message: `${env.appName} API is running`,
    api: `${env.appUrl}${env.apiPrefix}`,
    health: `${env.appUrl}/health`,
    website: env.clientUrl,
  })
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
