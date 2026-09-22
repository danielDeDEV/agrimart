const { FarmingTip, Produce, Region, User, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate, slugify } = require('../utils/helpers');
const { sendBulkSms } = require('../services/smsService');
const { LIKE } = require('../utils/search');
const auditService = require('../services/auditService');

const TIP_INCLUDES = [
  { model: Produce, as: 'produce', attributes: ['id', 'name', 'slug'] },
  { model: Region, as: 'region', attributes: ['id', 'name'] },
];

/** GET /tips — the public agronomy library. */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 12 });
  const where = { isPublished: true };

  if (req.query.category) where.category = req.query.category;
  if (req.query.produceId) where.produceId = req.query.produceId;
  if (req.query.regionId) where[Op.or] = [{ regionId: req.query.regionId }, { regionId: null }];
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    where[Op.or] = [{ title: { [LIKE]: term } }, { excerpt: { [LIKE]: term } }, { content: { [LIKE]: term } }];
  }

  const { rows, count } = await FarmingTip.findAndCountAll({
    where,
    include: TIP_INCLUDES,
    attributes: { exclude: ['content'] },
    order: [['isFeatured', 'DESC'], ['publishedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** GET /tips/:slug */
exports.getOne = asyncHandler(async (req, res) => {
  const where = /^\d+$/.test(req.params.slug) ? { id: req.params.slug } : { slug: req.params.slug };
  const tip = await FarmingTip.findOne({ where, include: TIP_INCLUDES });
  if (!tip) throw ApiError.notFound('That article could not be found');

  await tip.increment('views');

  const related = await FarmingTip.findAll({
    where: { category: tip.category, id: { [Op.ne]: tip.id }, isPublished: true },
    attributes: { exclude: ['content'] },
    limit: 3,
    order: [['publishedAt', 'DESC']],
  });

  return ok(res, { tip, related });
});

/** POST /admin/tips */
exports.create = asyncHandler(async (req, res) => {
  const tip = await FarmingTip.create({
    ...req.body,
    slug: slugify(req.body.title),
    createdBy: req.user.id,
    publishedAt: req.body.isPublished === false ? null : new Date(),
  });

  await auditService.record(req, {
    action: 'tip.create', entity: 'farming_tip', entityId: tip.id,
    description: `Published "${tip.title}"`,
  });

  return created(res, tip, 'Article published');
});

/** PATCH /admin/tips/:id */
exports.update = asyncHandler(async (req, res) => {
  const tip = await FarmingTip.findByPk(req.params.id);
  if (!tip) throw ApiError.notFound('Article not found');
  await tip.update({ ...req.body, ...(req.body.title ? { slug: slugify(req.body.title) } : {}) });
  return ok(res, tip, 'Article updated');
});

/** DELETE /admin/tips/:id */
exports.remove = asyncHandler(async (req, res) => {
  const tip = await FarmingTip.findByPk(req.params.id);
  if (!tip) throw ApiError.notFound('Article not found');
  await tip.destroy();
  await auditService.record(req, {
    action: 'tip.delete', entity: 'farming_tip', entityId: req.params.id,
    description: `Deleted "${tip.title}"`, severity: 'warning',
  });
  return ok(res, null, 'Article deleted');
});

/**
 * POST /admin/tips/:id/broadcast — push the condensed version to feature phones.
 * This is how agronomy advice reaches farmers who never open the website.
 */
exports.broadcast = asyncHandler(async (req, res) => {
  const tip = await FarmingTip.findByPk(req.params.id);
  if (!tip) throw ApiError.notFound('Article not found');
  if (!tip.smsVersion) throw ApiError.badRequest('Add an SMS version of this article before broadcasting');

  const where = { role: 'farmer', status: 'active', smsNotifications: true };
  if (tip.regionId) where.regionId = tip.regionId;

  const farmers = await User.findAll({ where, attributes: ['id', 'fullName', 'phone'] });
  if (!farmers.length) throw ApiError.badRequest('No farmers match this article audience');

  sendBulkSms(farmers, {
    template: 'farmingTip',
    data: { title: tip.title, body: tip.smsVersion },
    type: 'broadcast',
    relatedType: 'farming_tip',
    relatedId: tip.id,
  }).catch(() => {});

  await auditService.record(req, {
    action: 'tip.broadcast', entity: 'farming_tip', entityId: tip.id,
    description: `Broadcast "${tip.title}" to ${farmers.length} farmers`,
  });

  return ok(res, { recipients: farmers.length }, `Sending to ${farmers.length} farmer(s)`);
});

/** GET /admin/tips/:id — full article for the editor, without counting a view. */
exports.adminGetOne = asyncHandler(async (req, res) => {
  const tip = await FarmingTip.findByPk(req.params.id, { include: TIP_INCLUDES });
  if (!tip) throw ApiError.notFound('Article not found');
  return ok(res, tip);
});

/** GET /admin/tips — includes drafts. */
exports.adminList = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 20 });
  const { rows, count } = await FarmingTip.findAndCountAll({
    include: TIP_INCLUDES,
    attributes: { exclude: ['content'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return paginated(res, rows, { page, limit, total: count });
});
