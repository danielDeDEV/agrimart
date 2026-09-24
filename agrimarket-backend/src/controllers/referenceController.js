const { Region, District, Market, Category, Produce, Listing, MarketPrice, Op, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { slugify } = require('../utils/helpers');
const auditService = require('../services/auditService');
const { LIKE } = require('../utils/search');
const upload = require('../middleware/upload');
const storage = require('../services/storageService');
const { produceImage, categoryImage } = require('../utils/catalogPhotos');

/** Photos are managed through the upload endpoints below, never as free-text URLs. */
const withoutImage = ({ imageUrl, ...rest }) => rest;

/* ── Geography ────────────────────────────────────────────────────────── */

exports.regions = asyncHandler(async (req, res) => {
  const rows = await Region.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']],
    ...(req.query.withDistricts === 'true'
      ? { include: [{ model: District, as: 'districts', attributes: ['id', 'name'], where: { isActive: true }, required: false }] }
      : {}),
  });
  return ok(res, rows);
});

exports.districts = asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.regionId) where.regionId = req.query.regionId;
  const rows = await District.findAll({ where, order: [['name', 'ASC']] });
  return ok(res, rows);
});

exports.markets = asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.regionId) where.regionId = req.query.regionId;
  if (req.query.type) where.type = req.query.type;
  if (req.query.major === 'true') where.isMajor = true;

  const rows = await Market.findAll({
    where,
    include: [{ model: Region, as: 'region', attributes: ['id', 'name'] }],
    order: [['isMajor', 'DESC'], ['name', 'ASC']],
  });
  return ok(res, rows);
});

/* ── Produce taxonomy ─────────────────────────────────────────────────── */

exports.categories = asyncHandler(async (req, res) => {
  const rows = await Category.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    ...(req.query.withProduce === 'true'
      ? { include: [{ model: Produce, as: 'produces', attributes: ['id', 'name', 'slug', 'defaultUnit', 'imageUrl'], where: { isActive: true }, required: false }] }
      : {}),
  });

  if (req.query.withCounts === 'true') {
    const counts = await Listing.findAll({
      where: { status: 'active' },
      attributes: ['categoryId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['categoryId'],
      raw: true,
    });
    const map = Object.fromEntries(counts.map((c) => [c.categoryId, Number(c.count)]));
    return ok(res, rows.map((r) => ({ ...r.toJSON(), listingCount: map[r.id] || 0 })));
  }

  return ok(res, rows);
});

exports.produce = asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.categoryId) where.categoryId = req.query.categoryId;
  if (req.query.search) where.name = { [LIKE]: `%${req.query.search}%` };

  const rows = await Produce.findAll({
    where,
    include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'color', 'icon'] }],
    order: [['ussdIndex', 'ASC'], ['name', 'ASC']],
  });
  return ok(res, rows);
});

exports.produceDetail = asyncHandler(async (req, res) => {
  const where = /^\d+$/.test(req.params.id) ? { id: req.params.id } : { slug: req.params.id };
  const produce = await Produce.findOne({
    where,
    include: [{ model: Category, as: 'category' }],
  });
  if (!produce) throw ApiError.notFound('Produce not found');

  const [activeListings, avgPrice] = await Promise.all([
    Listing.count({ where: { produceId: produce.id, status: 'active' } }),
    // One aggregate over every recorded price for this produce. No ORDER BY:
    // with an aggregate and no GROUP BY, PostgreSQL requires the ordering
    // column to be aggregated too — and ordering a single row achieves
    // nothing in any case.
    MarketPrice.findOne({
      where: { produceId: produce.id },
      attributes: [[sequelize.fn('AVG', sequelize.col('avgPrice')), 'avg']],
      raw: true,
    }),
  ]);

  return ok(res, {
    ...produce.toJSON(),
    activeListings,
    averagePrice: Number(Number(avgPrice?.avg || 0).toFixed(2)),
  });
});

/* ── Admin management of reference data ───────────────────────────────── */

exports.createCategory = asyncHandler(async (req, res) => {
  const slug = slugify(req.body.name);
  const category = await Category.create({ ...withoutImage(req.body), slug, imageUrl: categoryImage(slug) });
  await auditService.record(req, {
    action: 'category.create', entity: 'category', entityId: category.id,
    description: `Created category "${category.name}"`,
  });
  return created(res, category, 'Category created');
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  await category.update({ ...withoutImage(req.body), ...(req.body.name ? { slug: slugify(req.body.name) } : {}) });
  return ok(res, category, 'Category updated');
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  const inUse = await Produce.count({ where: { categoryId: category.id } });
  if (inUse) throw ApiError.badRequest(`${inUse} produce type(s) still use this category`);
  await category.destroy();
  return ok(res, null, 'Category deleted');
});

exports.createProduce = asyncHandler(async (req, res) => {
  const slug = slugify(req.body.name);
  // A new produce type starts with the library photo when one exists for it
  const produce = await Produce.create({ ...withoutImage(req.body), slug, imageUrl: produceImage(slug) });
  await auditService.record(req, {
    action: 'produce.create', entity: 'produce', entityId: produce.id,
    description: `Added produce "${produce.name}"`,
  });
  return created(res, produce, 'Produce added');
});

exports.updateProduce = asyncHandler(async (req, res) => {
  const produce = await Produce.findByPk(req.params.id);
  if (!produce) throw ApiError.notFound('Produce not found');
  await produce.update({ ...withoutImage(req.body), ...(req.body.name ? { slug: slugify(req.body.name) } : {}) });
  return ok(res, produce, 'Produce updated');
});

exports.deleteProduce = asyncHandler(async (req, res) => {
  const produce = await Produce.findByPk(req.params.id);
  if (!produce) throw ApiError.notFound('Produce not found');
  const inUse = await Listing.count({ where: { produceId: produce.id } });
  if (inUse) throw ApiError.badRequest(`${inUse} listing(s) reference this produce — deactivate it instead`);
  await produce.destroy();
  return ok(res, null, 'Produce deleted');
});

/* ── Catalogue photos ─────────────────────────────────────────────────
 * Listings without the farmer's own photos show their produce's photo, so
 * these endpoints change what buyers see on every such listing at once. */

function catalogPhotoHandlers(Model, label, entity, libraryImage) {
  return {
    /** POST /:id/image — replace the photo with an upload (multipart field "image"). */
    upload: asyncHandler(async (req, res) => {
      if (!req.file) throw ApiError.badRequest('Choose a JPG, PNG or WEBP photo to upload');
      const url = await storage.save(req.file, 'catalog');
      const item = await Model.findByPk(req.params.id);
      if (!item) {
        await storage.remove(url);
        throw ApiError.notFound(`${label} not found`);
      }
      const previous = item.imageUrl;
      await item.update({ imageUrl: url });
      await storage.remove(previous);
      await auditService.record(req, {
        action: `${entity}.photo`, entity, entityId: item.id,
        description: `Uploaded a new photo for ${label.toLowerCase()} "${item.name}"`,
      });
      return ok(res, item, 'Photo updated. Listings without their own photos now show it.');
    }),

    /** DELETE /:id/image — go back to the built-in library photo (or none). */
    reset: asyncHandler(async (req, res) => {
      const item = await Model.findByPk(req.params.id);
      if (!item) throw ApiError.notFound(`${label} not found`);
      const previous = item.imageUrl;
      await item.update({ imageUrl: libraryImage(item.slug) });
      await storage.remove(previous);
      await auditService.record(req, {
        action: `${entity}.photo`, entity, entityId: item.id,
        description: `Reset the photo for ${label.toLowerCase()} "${item.name}"`,
      });
      return ok(res, item, item.imageUrl ? 'Library photo restored' : 'Photo removed');
    }),
  };
}

const producePhoto = catalogPhotoHandlers(Produce, 'Produce', 'produce', produceImage);
const categoryPhoto = catalogPhotoHandlers(Category, 'Category', 'category', categoryImage);
exports.uploadProduceImage = producePhoto.upload;
exports.resetProduceImage = producePhoto.reset;
exports.uploadCategoryImage = categoryPhoto.upload;
exports.resetCategoryImage = categoryPhoto.reset;

exports.createMarket = asyncHandler(async (req, res) => {
  const market = await Market.create({ ...req.body, slug: slugify(req.body.name) });
  await auditService.record(req, {
    action: 'market.create', entity: 'market', entityId: market.id,
    description: `Added market "${market.name}"`,
  });
  return created(res, market, 'Market added');
});

exports.updateMarket = asyncHandler(async (req, res) => {
  const market = await Market.findByPk(req.params.id);
  if (!market) throw ApiError.notFound('Market not found');
  await market.update({ ...req.body, ...(req.body.name ? { slug: slugify(req.body.name) } : {}) });
  return ok(res, market, 'Market updated');
});

exports.deleteMarket = asyncHandler(async (req, res) => {
  const market = await Market.findByPk(req.params.id);
  if (!market) throw ApiError.notFound('Market not found');
  await market.destroy();
  return ok(res, null, 'Market deleted');
});
