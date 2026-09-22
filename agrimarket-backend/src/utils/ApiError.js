class ApiError extends Error {
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Resource already exists') { return new ApiError(409, msg); }
  static unprocessable(msg = 'Validation failed', details) { return new ApiError(422, msg, details); }
  static tooMany(msg = 'Too many requests') { return new ApiError(429, msg); }
  static internal(msg = 'Something went wrong on our end') { return new ApiError(500, msg, null, false); }
}

module.exports = ApiError;
