const logger = require('../utils/logger');

let io = null;

/** Called once from server.js after the Socket.IO server is attached. */
const setIo = (instance) => { io = instance; };
const getIo = () => io;

const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const emitToRole = (role, event, payload) => {
  if (!io) return;
  io.to(`role:${role}`).emit(event, payload);
};

/** Admin dashboards subscribe here for the live activity feed. */
const emitToAdmins = (event, payload) => {
  if (!io) return;
  io.to('role:admin').to('role:superadmin').emit(event, payload);
};

const broadcast = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

const activity = (type, message, meta = {}) => {
  emitToAdmins('activity', { type, message, meta, at: new Date().toISOString() });
  logger.debug(`[activity] ${type}: ${message}`);
};

module.exports = { setIo, getIo, emitToUser, emitToRole, emitToAdmins, broadcast, activity };
