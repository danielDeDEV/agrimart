const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const logger = require('../utils/logger');
const { setIo } = require('./io');
const { allowedOrigins } = require('../config/origins');

/**
 * Realtime layer. Every socket joins a private `user:<id>` room plus a
 * `role:<role>` room, which is how the notification bell updates instantly and
 * how the admin console receives its live activity feed.
 */
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    pingTimeout: 30000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(); // anonymous visitors may watch public price updates

    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      const user = await User.findByPk(decoded.id);
      if (user && user.status === 'active') {
        socket.user = { id: user.id, role: user.role, fullName: user.fullName };
      }
    } catch {
      /* an expired token downgrades to anonymous rather than dropping the socket */
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      socket.join(`role:${socket.user.role}`);
      logger.debug(`Socket connected: ${socket.user.fullName} (${socket.user.role})`);
    }

    socket.join('public');

    // The marketplace page subscribes to a produce to see new listings appear
    socket.on('watch:produce', (produceId) => socket.join(`produce:${produceId}`));
    socket.on('unwatch:produce', (produceId) => socket.leave(`produce:${produceId}`));

    socket.on('disconnect', () => {
      if (socket.user) logger.debug(`Socket disconnected: ${socket.user.fullName}`);
    });
  });

  setIo(io);
  logger.success('Realtime gateway ready');
  return io;
}

module.exports = { initSockets };
