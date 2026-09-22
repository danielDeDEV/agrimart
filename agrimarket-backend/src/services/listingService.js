const { Listing, Produce, Category, User, Region, District, Op } = require('../models');
const { generateCode } = require('../utils/helpers');
const { sendSms } = require('./smsService');
const { notify } = require('./notificationService');
const { activity } = require('../sockets/io');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { get: setting } = require('../services/settingsService');

const LISTING_INCLUDES = [
  { model: Produce, as: 'produce', attributes: ['id', 'name', 'slug', 'imageUrl', 'defaultUnit', 'isPerishable'] },
  { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon', 'color'] },
  { model: Region, as: 'region', attributes: ['id', 'name'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
  {
    model: User,
    as: 'farmer',
    // status is needed so a suspended seller's produce can be hidden from buyers
    attributes: ['id', 'uuid', 'fullName', 'phone', 'avatarUrl', 'ratingAvg', 'ratingCount', 'isVerifiedSeller', 'community', 'regionId', 'status'],
  },
];

/** Multipart forms send booleans as the strings "true" / "false". */
const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode('LST');
    if (!(await Listing.findOne({ where: { code }, paranoid: false }))) return code;
  }
  return `LST-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Creates a listing from any channel. Web posts go live immediately; USSD and
 * SMS posts also go live so a farmer standing in a field gets an instant
 * confirmation, and moderators can pull them down afterwards.
 */
async function createListing(payload, { channel = 'web', notifyFarmer = true } = {}) {
  const farmer = await User.findByPk(payload.farmerId);
  if (!farmer) throw ApiError.notFound('Farmer account not found');

  const produce = await Produce.findByPk(payload.produceId);
  if (!produce) throw ApiError.badRequest('Select a valid produce type');

  // One farmer cannot fill the marketplace on their own. Every channel — web,
  // USSD and SMS — comes through here, so the limit holds everywhere.
  const maxActive = Number(setting('max_active_listings'));
  if (Number.isFinite(maxActive) && maxActive > 0) {
    const open = await Listing.count({ where: { farmerId: farmer.id, status: ['active', 'pending', 'reserved'] } });
    if (open >= maxActive) {
      throw ApiError.badRequest(
        `You already have ${open} listings on the marketplace, which is the most allowed. Mark one as sold or remove it first.`
      );
    }
  }

  const days = Number(setting(produce.isPerishable ? 'perishable_expiry_days' : 'listing_expiry_days'));
  const expiresAt = payload.expiresAt || new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  // Farmers on USSD need an instant answer, so listings normally publish at
  // once and are moderated afterwards. Admin → Settings can switch that round.
  const status = setting('auto_approve_listings') ? 'active' : 'pending';

  const listing = await Listing.create({
    code: await uniqueCode(),
    farmerId: farmer.id,
    produceId: produce.id,
    categoryId: produce.categoryId,
    title: payload.title || `${produce.name} — ${payload.quantity} ${payload.unit || produce.defaultUnit}`,
    description: payload.description || null,
    quantity: payload.quantity,
    quantityRemaining: payload.quantity,
    unit: payload.unit || produce.defaultUnit,
    pricePerUnit: payload.pricePerUnit,
    minOrderQuantity: payload.minOrderQuantity || 1,
    negotiable: toBool(payload.negotiable, true),
    qualityGrade: payload.qualityGrade || 'A',
    isOrganic: toBool(payload.isOrganic),
    harvestDate: payload.harvestDate || null,
    availableFrom: payload.availableFrom || null,
    expiresAt,
    regionId: payload.regionId || farmer.regionId,
    districtId: payload.districtId || farmer.districtId,
    location: payload.location || farmer.community || null,
    latitude: payload.latitude || farmer.latitude,
    longitude: payload.longitude || farmer.longitude,
    // Farmer uploads only. Without any, buyers see the produce's catalogue
    // photo (Listing.coverImage), which is how USSD and SMS listings get a picture.
    images: Array.isArray(payload.images) ? payload.images.filter((u) => typeof u === 'string' && u) : [],
    status,
    source: channel,
    isUrgent: toBool(payload.isUrgent),
  });

  if (notifyFarmer) {
    await sendSms({
      to: farmer.phone,
      userId: farmer.id,
      template: status === 'pending' ? 'listingPending' : 'listingCreated',
      data: {
        code: listing.code,
        produce: produce.name,
        quantity: listing.quantity,
        unit: listing.unit,
        price: listing.pricePerUnit,
      },
      type: 'listing',
      relatedType: 'listing',
      relatedId: listing.id,
    });
  }

  await notifyInterestedBuyers(listing, produce, farmer).catch((err) =>
    logger.warn('Buyer match notification failed:', err.message)
  );

  activity('listing.created', `${farmer.fullName} listed ${listing.quantity} ${listing.unit} of ${produce.name}`, {
    listingId: listing.id,
    channel,
  });

  return getListing(listing.id);
}

/**
 * Objective 2 in practice: when new supply appears, buyers who previously bought
 * or alerted on that produce are told about it over SMS and in-app.
 */
async function notifyInterestedBuyers(listing, produce, farmer) {
  const buyers = await User.findAll({
    where: {
      role: 'buyer',
      status: 'active',
      [Op.or]: [{ regionId: listing.regionId }, { businessType: ['aggregator', 'wholesaler', 'exporter'] }],
    },
    limit: 25,
  });

  await Promise.allSettled(
    buyers.map((buyer) =>
      notify({
        userId: buyer.id,
        title: `New ${produce.name} available`,
        message: `${farmer.fullName} listed ${listing.quantity} ${listing.unit} of ${produce.name} at GHS ${listing.pricePerUnit}/${listing.unit}.`,
        type: 'listing',
        icon: 'Sprout',
        link: `/marketplace/${listing.code}`,
        relatedType: 'listing',
        relatedId: listing.id,
      })
    )
  );
}

const getListing = (idOrCode, options = {}) => {
  const where = /^\d+$/.test(String(idOrCode)) ? { id: idOrCode } : { code: idOrCode };
  return Listing.findOne({ where, include: LISTING_INCLUDES, ...options });
};

/** Shared query builder used by the public marketplace and the admin table. */
function buildListingQuery(query = {}) {
  const where = {};

  if (query.status) where.status = query.status;
  else where.status = 'active';

  if (query.produceId) where.produceId = query.produceId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.regionId) where.regionId = query.regionId;
  if (query.districtId) where.districtId = query.districtId;
  if (query.farmerId) where.farmerId = query.farmerId;
  if (query.source) where.source = query.source;
  if (query.qualityGrade) where.qualityGrade = query.qualityGrade;
  if (query.isOrganic === 'true' || query.isOrganic === true) where.isOrganic = true;
  if (query.featured === 'true') where.isFeatured = true;

  if (query.minPrice || query.maxPrice) {
    where.pricePerUnit = {};
    if (query.minPrice) where.pricePerUnit[Op.gte] = Number(query.minPrice);
    if (query.maxPrice) where.pricePerUnit[Op.lte] = Number(query.maxPrice);
  }

  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { title: { [Op.like]: term } },
      { description: { [Op.like]: term } },
      { code: { [Op.like]: term } },
      { location: { [Op.like]: term } },
    ];
  }

  const sortMap = {
    newest: [['createdAt', 'DESC']],
    oldest: [['createdAt', 'ASC']],
    price_low: [['pricePerUnit', 'ASC']],
    price_high: [['pricePerUnit', 'DESC']],
    quantity: [['quantity', 'DESC']],
    popular: [['views', 'DESC']],
  };

  return { where, order: sortMap[query.sort] || sortMap.newest };
}

/**
 * What the public marketplace joins on: the same includes, but the farmer must
 * be an active account. A suspended or deleted seller's produce disappears from
 * browsing at once, and comes back by itself if they are reinstated.
 */
const PUBLIC_LISTING_INCLUDES = LISTING_INCLUDES.map((include) =>
  (include.as === 'farmer' ? { ...include, required: true, where: { status: 'active' } } : include)
);

module.exports = {
  createListing, getListing, buildListingQuery,
  LISTING_INCLUDES, PUBLIC_LISTING_INCLUDES, uniqueCode,
};
