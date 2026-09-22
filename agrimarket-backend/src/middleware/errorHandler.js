const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { discardUploads } = require('./upload');

const notFound = (req, _res, next) =>
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist on this API`));

// eslint-disable-next-line no-unused-vars
const errorHandler = async (err, req, res, _next) => {
  let error = err;

  /**
   * Multer writes each photo to disk as it streams, so a request that is then
   * refused — too many files, the wrong owner, a validation failure — has
   * already left them there. Clearing them here covers every route at once,
   * and finishes before the response so nothing lingers.
   */
  await discardUploads(req);

  // Translate Sequelize failures into clean API errors
  if (err.name === 'SequelizeValidationError') {
    error = ApiError.unprocessable(
      'Some fields need your attention',
      err.errors.map((e) => ({ field: e.path, message: e.message }))
    );
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'value';
    const friendly = {
      phone: 'That phone number is already registered',
      email: 'That email address is already registered',
    }[field];
    error = ApiError.conflict(friendly || `That ${field} is already in use`);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = ApiError.badRequest('A referenced record does not exist');
  } else if (err.name === 'SequelizeDatabaseError') {
    logger.error('Database error:', err.message);
    error = ApiError.internal('A database error occurred');
  } else if (err.name === 'SequelizeConnectionRefusedError' || err.name === 'SequelizeConnectionError') {
    error = new ApiError(503, 'Cannot reach the database. Is MySQL running in XAMPP?');
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON');
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    error = ApiError.badRequest('That file is too large. Maximum size is 5MB.');
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    // Multer: too many files, or a file under an unexpected field name
    error = ApiError.badRequest('Too many photos in one upload. A listing can have at most 5.');
  } else if (!(err instanceof ApiError)) {
    error = new ApiError(err.statusCode || 500, err.message || 'Something went wrong', null, false);
  }

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} →`, err.message, env.isDev ? `\n${err.stack}` : '');
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
    ...(env.isDev && error.statusCode >= 500 ? { stack: err.stack } : {}),
  });
};

module.exports = { notFound, errorHandler };
