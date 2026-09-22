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

const makeStorage = (folder) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(path.join(uploadsRoot(), folder))),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${folder}-${unique}${ext}`);
    },
  });

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
 * Deletes a file this server stored, given the public URL it was served at.
 * Anything that is not one of our uploads (a catalogue photo, a foreign URL)
 * is left alone, and a path can never escape the uploads folder.
 */
function removeStoredFile(url) {
  const match = typeof url === 'string' && url.match(/\/uploads\/([a-z]+)\/([^/?#]+)$/i);
  if (!match) return Promise.resolve();
  const root = uploadsRoot();
  const file = path.join(root, match[1], path.basename(match[2]));
  if (!file.startsWith(root + path.sep)) return Promise.resolve();
  return fs.promises.unlink(file).catch(() => {});
}

/** Deletes whatever multer has already written for a request that failed. */
function discardUploads(req) {
  const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
  if (!files.length) return Promise.resolve();
  return Promise.all(files.map((f) => (f?.path ? fs.promises.unlink(f.path).catch(() => {}) : null)));
}

module.exports = {
  uploadsRoot,
  discardUploads,
  PHOTO_HARD_CAP,
  maxListingPhotos,
  listingImages: multer({ storage: makeStorage('listings'), fileFilter: imageFilter, limits }).array('images', PHOTO_HARD_CAP),
  avatar: multer({ storage: makeStorage('avatars'), fileFilter: imageFilter, limits }).single('avatar'),
  /** Replacement photos for produce types and categories, uploaded by admins. */
  catalogImage: multer({ storage: makeStorage('catalog'), fileFilter: imageFilter, limits }).single('image'),
  /**
   * Evidence people attach to a payment or a complaint: a MoMo confirmation
   * screenshot, a photo of what arrived. Kept apart from listing photos so it
   * is never shown in the marketplace.
   */
  evidenceImages: multer({ storage: makeStorage('evidence'), fileFilter: imageFilter, limits }).array('attachments', 4),
  MAX_EVIDENCE_FILES: 4,
  /** Public URL for a stored file, used when building API responses. */
  publicUrl: (req, folder, filename) =>
    `${req.protocol}://${req.get('host')}/uploads/${folder}/${filename}`,
  removeStoredFile,
};
