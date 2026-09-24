const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Resolved from this file so the service runs the same under pm2 or systemd. */
const uploadsRoot = () => path.resolve(__dirname, '..', '..', 'uploads');

/**
 * Files are held in memory, not written to disk by multer.
 *
 * Where they finally land is storageService's decision — a local folder or
 * object storage — and a request that is refused never writes anything at all,
 * which is what stops rejected uploads leaving files behind.
 */
const makeStorage = () => multer.memoryStorage();

const imageFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) && file.mimetype.startsWith('image/')) return cb(null, true);
  cb(ApiError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed'));
};

const limits = { fileSize: 5 * 1024 * 1024 };

/**
 * A listing holds at most this many of the farmer's own photos. The admin
 * setting decides the real limit; this is the ceiling multer will accept so a
 * raised setting needs no restart.
 */
const PHOTO_HARD_CAP = 10;
const maxListingPhotos = () => {
  const { get } = require('../services/settingsService');
  const value = Number(get('max_listing_images'));
  return Math.max(1, Math.min(PHOTO_HARD_CAP, Number.isFinite(value) ? value : 5));
};

/**
 * Deletes a file this platform stored, given the public URL it was served at.
 * Anything that is not one of our uploads — a catalogue photo, a foreign URL —
 * is left alone. Required lazily, because storageService reads configuration
 * that is loaded after this module.
 */
function removeStoredFile(url) {
  return require('../services/storageService').remove(url);
}


/**
 * Nothing to discard any more: multer keeps uploads in memory, so a request
 * that fails before the controller stores them leaves no trace. Kept as a
 * no-op because the error handler still calls it, and because a future driver
 * that buffers to disk would need it again.
 */
function discardUploads(_req) {
  return Promise.resolve();
}

module.exports = {
  uploadsRoot,
  discardUploads,
  PHOTO_HARD_CAP,
  maxListingPhotos,
  listingImages: multer({ storage: makeStorage(), fileFilter: imageFilter, limits }).array('images', PHOTO_HARD_CAP),
  avatar: multer({ storage: makeStorage(), fileFilter: imageFilter, limits }).single('avatar'),
  /** Replacement photos for produce types and categories, uploaded by admins. */
  catalogImage: multer({ storage: makeStorage(), fileFilter: imageFilter, limits }).single('image'),
  /**
   * Evidence people attach to a payment or a complaint: a MoMo confirmation
   * screenshot, a photo of what arrived. Kept apart from listing photos so it
   * is never shown in the marketplace.
   */
  evidenceImages: multer({ storage: makeStorage(), fileFilter: imageFilter, limits }).array('attachments', 4),
  MAX_EVIDENCE_FILES: 4,
  /** Public URL for a stored file, used when building API responses. */
  publicUrl: (req, folder, filename) =>
    `${req.protocol}://${req.get('host')}/uploads/${folder}/${filename}`,
  removeStoredFile,
};
