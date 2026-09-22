/**
 * The built-in photo library.
 *
 * Farmers selling over USSD or SMS cannot attach a picture, so every produce
 * type and category carries a catalogue photo. A listing with no photos of its
 * own is shown with its produce's catalogue photo — resolved when it is read,
 * never copied onto the listing, so replacing a catalogue photo updates every
 * listing that relies on it.
 *
 * The image files live in the website's public folder
 * (agrimarket-frontend/public/images/...), so the paths stored here are
 * relative to the website. `src/data/catalogPhotos.json` lists which slugs
 * have a photo; it is written by the same step that adds the image files.
 */
const library = require('../data/catalogPhotos.json');

const produceImage = (slug) => library.produce[slug] || null;
const categoryImage = (slug) => library.categories[slug] || null;

/**
 * True for a stock picture rather than a farmer's own upload: a library path,
 * or a Wikimedia link from before the library existed.
 */
const isCataloguePhoto = (url) =>
  typeof url === 'string' && (/^\/images\/(produce|categories)\//.test(url) || /wikimedia\.org\//i.test(url));

module.exports = { library, produceImage, categoryImage, isCataloguePhoto };
