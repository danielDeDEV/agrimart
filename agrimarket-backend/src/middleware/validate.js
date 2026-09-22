const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs after an express-validator chain and converts failures to a 422. */
const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));

  next(ApiError.unprocessable(errors[0].message, errors));
};

module.exports = validate;
