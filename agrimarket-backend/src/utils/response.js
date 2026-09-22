const ok = (res, data = null, message = 'Success', meta = undefined) =>
  res.status(200).json({ success: true, message, data, ...(meta ? { meta } : {}) });

const created = (res, data = null, message = 'Created successfully') =>
  res.status(201).json({ success: true, message, data });

const paginated = (res, rows, { page, limit, total }, message = 'Success') =>
  res.status(200).json({
    success: true,
    message,
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });

const noContent = (res) => res.status(204).send();

module.exports = { ok, created, paginated, noContent };
