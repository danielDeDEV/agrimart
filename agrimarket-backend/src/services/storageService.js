const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Where uploaded files live: a farmer's listing photos, profile pictures,
 * replacement catalogue images, and the screenshots people attach to payment
 * disputes.
 *
 * On a server with its own disk, writing to `uploads/` is right. On a hosted
 * platform the disk is wiped on every deploy, which would silently destroy the
 * evidence a farmer attached to a disputed payment — so there the files go to
 * object storage instead.
 *
 * Both behave identically to the rest of the application: hand `save()` an
 * uploaded file, get back a public URL. Which one runs is decided by
 * STORAGE_DRIVER, or inferred from whether a bucket is configured.
 */

const supabase = {
  url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  key: process.env.SUPABASE_SERVICE_KEY || '',
  bucket: process.env.SUPABASE_BUCKET || 'uploads',
};

const DRIVER = (process.env.STORAGE_DRIVER || (supabase.url && supabase.key ? 'supabase' : 'local')).toLowerCase();

const uploadsRoot = () => path.resolve(__dirname, '..', '..', 'uploads');

/**
 * How long a browser or CDN may keep a file.
 *
 * Listing photos, avatars and catalogue images never change — their names
 * carry a timestamp and random suffix — so a year is right and saves a
 * farmer's data bundle on every page.
 *
 * Evidence is different. Those are screenshots of mobile-money confirmations
 * attached to a payment dispute, and when one is deleted it has to actually
 * stop being served. A long cache would keep handing it out from the edge for
 * a year after it was removed.
 */
// Supabase prepends "public," to whatever is sent, so "private" would be
// contradicted; the short lifetime is what actually does the work here.
const cacheFor = (folder) => (folder === 'evidence' ? 'max-age=60' : 'max-age=31536000');

/** A name that cannot collide and cannot be guessed. */
function safeName(folder, originalName) {
  const ext = (path.extname(originalName || '') || '.jpg').toLowerCase().slice(0, 8);
  return `${folder}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

/* ── Local disk ──────────────────────────────────────────────────────── */

const local = {
  async save(file, folder) {
    const dir = path.join(uploadsRoot(), folder);
    await fs.promises.mkdir(dir, { recursive: true });
    const name = safeName(folder, file.originalname);
    await fs.promises.writeFile(path.join(dir, name), file.buffer);
    return `${env.appUrl.replace(/\/$/, '')}/uploads/${folder}/${name}`;
  },

  async remove(url) {
    // Only ever deletes inside the uploads folder, whatever the URL claims
    const match = typeof url === 'string' && url.match(/\/uploads\/([a-z]+)\/([^/?#]+)$/i);
    if (!match) return false;
    const root = uploadsRoot();
    const file = path.join(root, match[1], path.basename(match[2]));
    if (!file.startsWith(root + path.sep)) return false;
    await fs.promises.unlink(file).catch(() => {});
    return true;
  },
};

/* ── Supabase Storage ────────────────────────────────────────────────── */

const bucketApi = (objectPath) => `${supabase.url}/storage/v1/object/${supabase.bucket}/${objectPath}`;

const remote = {
  async save(file, folder) {
    const name = safeName(folder, file.originalname);
    const objectPath = `${folder}/${name}`;

    const res = await fetch(bucketApi(objectPath), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabase.key}`,
        'Content-Type': file.mimetype || 'application/octet-stream',
        'cache-control': cacheFor(folder),
      },
      body: file.buffer,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Could not store the file (${res.status}): ${detail.slice(0, 160)}`);
    }
    return `${supabase.url}/storage/v1/object/public/${supabase.bucket}/${objectPath}`;
  },

  async remove(url) {
    const marker = `/storage/v1/object/public/${supabase.bucket}/`;
    const at = typeof url === 'string' ? url.indexOf(marker) : -1;
    if (at === -1) return false;

    const objectPath = url.slice(at + marker.length).split(/[?#]/)[0];
    const res = await fetch(bucketApi(objectPath), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${supabase.key}` },
    });
    if (!res.ok && res.status !== 404) {
      logger.warn(`Could not delete ${objectPath} from storage (${res.status})`);
    }
    return true;
  },
};

const driver = DRIVER === 'supabase' ? remote : local;

/**
 * Stores one uploaded file and returns its public URL.
 * `file` is what multer's memory storage produces: { buffer, originalname, mimetype }.
 */
const save = (file, folder) => driver.save(file, folder);

/** Stores several, in parallel. */
const saveAll = (files, folder) => Promise.all((files || []).map((f) => driver.save(f, folder)));

/**
 * Deletes a file this platform stored, given the URL it was served at.
 * Anything else — a catalogue photo, a foreign URL — is left alone. Never
 * throws: a failed cleanup must not fail the request that triggered it.
 */
const remove = async (url) => {
  try {
    // Try both drivers: a database may hold URLs written before a storage move
    if (await driver.remove(url)) return true;
    const other = driver === remote ? local : remote;
    if (DRIVER === 'supabase' || supabase.url) return await other.remove(url).catch(() => false);
    return false;
  } catch (err) {
    logger.warn(`Could not remove ${String(url).slice(0, 80)}: ${err.message}`);
    return false;
  }
};

/** Removes several, ignoring anything that was not ours. */
const removeAll = (urls) => Promise.all((urls || []).map(remove));

/** Describes the active driver, for the boot banner and the go-live audit. */
const describe = () =>
  DRIVER === 'supabase'
    ? `object storage (${supabase.bucket} at ${supabase.url.replace(/^https?:\/\//, '')})`
    : `local disk (${uploadsRoot()})`;

const isRemote = DRIVER === 'supabase';

/** True when the configuration is usable; the audit explains what is missing. */
function check() {
  if (DRIVER !== 'supabase') return { ok: true, driver: 'local', detail: describe() };
  const missing = [];
  if (!supabase.url) missing.push('SUPABASE_URL');
  if (!supabase.key) missing.push('SUPABASE_SERVICE_KEY');
  return missing.length
    ? { ok: false, driver: 'supabase', detail: `missing ${missing.join(' and ')}` }
    : { ok: true, driver: 'supabase', detail: describe() };
}

module.exports = { save, saveAll, remove, removeAll, describe, isRemote, check, uploadsRoot, DRIVER };
