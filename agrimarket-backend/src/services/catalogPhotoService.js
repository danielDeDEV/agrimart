const { Produce, Category, Listing, Op, sequelize } = require('../models');
const { produceImage, categoryImage, isCataloguePhoto } = require('../utils/catalogPhotos');
const logger = require('../utils/logger');
const { LIKE } = require('../utils/search');

const isLibraryPath = (url) => typeof url === 'string' && url.startsWith('/images/');
const isLegacyLink = (url) => typeof url === 'string' && /wikimedia\.org\//i.test(url);

/** Gives each row its library photo unless an admin has uploaded their own. */
async function fillCatalogue(Model, libraryImage) {
  const rows = await Model.findAll({ attributes: ['id', 'slug', 'imageUrl'] });
  let changed = 0;
  for (const row of rows) {
    const target = libraryImage(row.slug);
    const replaceable = !row.imageUrl || isLegacyLink(row.imageUrl) || isLibraryPath(row.imageUrl);
    if (replaceable && row.imageUrl !== target) {
      // eslint-disable-next-line no-await-in-loop
      await Model.update({ imageUrl: target }, { where: { id: row.id }, silent: true });
      changed += 1;
    }
  }
  return changed;
}

/**
 * Brings an existing database in line with the photo library. Safe to run on
 * every start: it only touches rows that still point at a missing or legacy
 * picture, and listings that hold a copied catalogue photo instead of relying
 * on the live fallback.
 */
async function ensureCatalogPhotos() {
  const produce = await fillCatalogue(Produce, produceImage);
  const categories = await fillCatalogue(Category, categoryImage);

  const imagesText = sequelize.cast(sequelize.col('images'), 'CHAR');
  const copies = await Listing.findAll({
    attributes: ['id', 'images'],
    where: {
      [Op.or]: [
        sequelize.where(imagesText, LIKE, '%wikimedia.org%'),
        sequelize.where(imagesText, LIKE, '%/images/produce/%'),
        sequelize.where(imagesText, LIKE, '%/images/categories/%'),
      ],
    },
    paranoid: false,
  });
  for (const listing of copies) {
    const own = (listing.images || []).filter((url) => !isCataloguePhoto(url));
    // eslint-disable-next-line no-await-in-loop
    await Listing.update({ images: own }, { where: { id: listing.id }, silent: true, paranoid: false });
  }

  if (produce || categories || copies.length) {
    logger.success(
      `Photo library applied: ${produce} produce, ${categories} categories, ${copies.length} listing(s) now use the live catalogue photo`
    );
  }
  return { produce, categories, listings: copies.length };
}

module.exports = { ensureCatalogPhotos };
