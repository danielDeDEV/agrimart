const { Listing, Produce, Category, User, Region, Favorite, Offer, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const listingService = require('../services/listingService');
const auditService = require('../services/auditService');
const upload = require('../middleware/upload');
const storage = require('../services/storageService');
const { isCataloguePhoto } = require('../utils/catalogPhotos');

/** GET /listings — public marketplace feed with filters, search and sorting. */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { where, order } = listingService.buildListingQuery(req.query);

  const include = [...listingService.PUBLIC_LISTING_INCLUDES];
  if (req.query.categorySlug) {
    include[1] = { ...include[1], where: { slug: req.query.categorySlug }, required: true };
  }

  const { rows, count } = await Listing.findAndCountAll({
    where,
    include,
    order,
    limit,
    offset,
    distinct: true,
  });

  let favouriteIds = [];
  if (req.user) {
    const favs = await Favorite.findAll({
      where: { userId: req.user.id, listingId: rows.map((r) => r.id) },
      attributes: ['listingId'],
    });
    favouriteIds = favs.map((f) => f.listingId);
  }

  const data = rows.map((r) => ({ ...r.toJSON(), isFavorited: favouriteIds.includes(r.id) }));
  return paginated(res, data, { page, limit, total: count });
});

/** GET /listings/:code */
exports.getOne = asyncHandler(async (req, res) => {
  const listing = await listingService.getListing(req.params.code);
  if (!listing) throw ApiError.notFound('That listing could not be found');

  // A suspended seller's page stays open to them and to staff, not to buyers
  const ownerOrStaff = req.user && (req.user.id === listing.farmerId || req.user.isAdmin());
  if (listing.farmer?.status !== 'active' && !ownerOrStaff) {
    throw ApiError.notFound('That listing is no longer available');
  }

  // Do not inflate the farmer's own view count
  if (!req.user || req.user.id !== listing.farmerId) await listing.increment('views');

  const similar = await Listing.findAll({
    where: {
      produceId: listing.produceId,
      status: 'active',
      id: { [Op.ne]: listing.id },
    },
    include: listingService.PUBLIC_LISTING_INCLUDES,
    limit: 6,
    order: [['pricePerUnit', 'ASC']],
  });

  const isFavorited = req.user
    ? !!(await Favorite.findOne({ where: { userId: req.user.id, listingId: listing.id } }))
    : false;

  return ok(res, { listing: { ...listing.toJSON(), isFavorited }, similar });
});

/** POST /listings */
exports.create = asyncHandler(async (req, res) => {
  if (req.user.role === 'buyer' && !req.body.allowBuyerListing) {
    // Buyers can still list surplus, but we flag it so admins see the mix
    req.body.source = 'web';
  }

  // Photos can only arrive as uploaded files — never as URLs in the form body
  const images = await storage.saveAll(req.files, 'listings');
  const limit = upload.maxListingPhotos();
  if (images.length > limit) {
    await storage.removeAll(images);
    throw ApiError.badRequest(`A listing can have at most ${limit} photo${limit > 1 ? 's' : ''}.`);
  }

  const listing = await listingService.createListing(
    { ...req.body, farmerId: req.user.id, images },
    { channel: 'web' }
  );

  return created(res, listing, listing.status === 'pending'
    ? 'Listing received. It goes live as soon as our team reviews it.'
    : 'Your listing is live. Buyers can see it now.');
});

/** PATCH /listings/:id */
exports.update = asyncHandler(async (req, res) => {
  const added = await storage.saveAll(req.files, 'listings');
  // Multer has already written any new photos; discard them if we refuse the edit
  const reject = async (error) => {
    await Promise.all(added.map(upload.removeStoredFile));
    throw error;
  };

  const listing = await Listing.findByPk(req.params.id);
  if (!listing) await reject(ApiError.notFound('Listing not found'));
  if (listing.farmerId !== req.user.id && !req.user.isAdmin()) {
    await reject(ApiError.forbidden('You can only edit your own listings'));
  }

  const editable = [
    'title', 'description', 'quantity', 'quantityRemaining', 'unit', 'pricePerUnit',
    'minOrderQuantity', 'negotiable', 'qualityGrade', 'isOrganic', 'harvestDate',
    'availableFrom', 'expiresAt', 'regionId', 'districtId', 'location', 'status', 'isUrgent',
  ];
  const patch = {};
  editable.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

  // Photos: `keepImages` (JSON array or repeated field) is the subset of the
  // current photos to keep, so a farmer can remove some; new files are added.
  const stored = listing.images || [];
  const current = stored.filter((url) => !isCataloguePhoto(url));
  let kept = current;
  if (req.body.keepImages !== undefined) {
    let wanted = req.body.keepImages;
    if (typeof wanted === 'string') {
      try { wanted = JSON.parse(wanted); } catch { wanted = [wanted]; }
    }
    wanted = Array.isArray(wanted) ? wanted : [];
    kept = current.filter((url) => wanted.includes(url));
  }
  const limit = upload.maxListingPhotos();
  if (kept.length + added.length > limit) {
    await reject(ApiError.badRequest(`A listing can have at most ${limit} photo${limit > 1 ? 's' : ''}. Remove one first.`));
  }
  const removed = current.filter((url) => !kept.includes(url));
  if (removed.length || added.length || kept.length !== stored.length) patch.images = [...kept, ...added];

  if (patch.status && !['active', 'withdrawn', 'sold'].includes(patch.status) && !req.user.isAdmin()) {
    await reject(ApiError.badRequest('You can only set a listing to active, sold or withdrawn'));
  }

  await listing.update(patch);
  await storage.removeAll(removed);

  const message = added.length
    ? `${added.length} photo${added.length > 1 ? 's' : ''} added`
    : removed.length ? 'Photo removed' : 'Listing updated';
  return ok(res, await listingService.getListing(listing.id), message);
});

/** DELETE /listings/:id */
exports.remove = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) throw ApiError.notFound('Listing not found');
  if (listing.farmerId !== req.user.id && !req.user.isAdmin()) {
    throw ApiError.forbidden('You can only remove your own listings');
  }

  const openOrders = await require('../models').Order.count({
    where: { listingId: listing.id, status: ['pending', 'accepted', 'paid', 'in_transit'] },
  });
  if (openOrders) throw ApiError.badRequest('This listing has open orders. Complete or cancel them first.');

  await listing.destroy();
  if (req.user.isAdmin()) {
    await auditService.record(req, {
      action: 'listing.delete', entity: 'listing', entityId: listing.id,
      description: `Removed listing ${listing.code}`, severity: 'warning',
    });
  }
  return ok(res, null, 'Listing removed');
});

/** GET /listings/mine */
exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const where = { farmerId: req.user.id };
  if (req.query.status) where.status = req.query.status;

  const { rows, count } = await Listing.findAndCountAll({
    where,
    include: listingService.LISTING_INCLUDES,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows, { page, limit, total: count });
});

/** POST /listings/:id/favorite — toggles. */
exports.toggleFavorite = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) throw ApiError.notFound('Listing not found');

  const existing = await Favorite.findOne({ where: { userId: req.user.id, listingId: listing.id } });
  if (existing) {
    await existing.destroy();
    return ok(res, { isFavorited: false }, 'Removed from saved listings');
  }

  await Favorite.create({ userId: req.user.id, listingId: listing.id });
  return ok(res, { isFavorited: true }, 'Saved to your listings');
});

/** GET /listings/favorites */
exports.favorites = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { rows, count } = await Favorite.findAndCountAll({
    where: { userId: req.user.id },
    include: [{ model: Listing, as: 'listing', include: listingService.LISTING_INCLUDES }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return paginated(res, rows.map((f) => f.listing).filter(Boolean), { page, limit, total: count });
});

/** GET /listings/featured — used by the landing page. */
exports.featured = asyncHandler(async (req, res) => {
  const limit = Math.min(24, parseInt(req.query.limit, 10) || 8);
  const rows = await Listing.findAll({
    where: { status: 'active' },
    include: listingService.LISTING_INCLUDES,
    order: [['isFeatured', 'DESC'], ['views', 'DESC'], ['createdAt', 'DESC']],
    limit,
  });
  return ok(res, rows);
});

/** GET /listings/:id/offers — farmer view of the negotiations on a listing. */
exports.listingOffers = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) throw ApiError.notFound('Listing not found');
  if (listing.farmerId !== req.user.id && !req.user.isAdmin()) throw ApiError.forbidden();

  const offers = await Offer.findAll({
    where: { listingId: listing.id },
    include: [{ model: User, as: 'buyer', attributes: ['id', 'fullName', 'phone', 'businessName', 'ratingAvg', 'avatarUrl'] }],
    order: [['createdAt', 'DESC']],
  });
  return ok(res, offers);
});
