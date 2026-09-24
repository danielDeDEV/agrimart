import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { suite, API, sql, envValue, BACKEND_DIR, FRONTEND_DIR, col } from './helpers.mjs';

const t = suite('Photos — every listing gets a picture, including USSD and SMS sellers');
const check = (...args) => t.check(...args);
// End-to-end checks for automatic catalogue photos.
const UPLOADS = join(BACKEND_DIR, 'uploads');
const JPEG = readFileSync(join(FRONTEND_DIR, 'public/images/produce/okra.jpg'));
const created = { listings: [] };

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(API + path, { method, headers, body });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const photoForm = (count, extra = {}) => {
  const f = new FormData();
  for (let i = 0; i < count; i++) f.append('images', new Blob([JPEG], { type: 'image/jpeg' }), `farm-${i}.jpg`);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
};
/**
 * Is the file actually stored?
 *
 * On local disk that means the file is there. On object storage the disk is
 * irrelevant — what matters is whether the URL serves it. A cache-busting
 * query is appended so a stale edge copy cannot make a deleted file look
 * present.
 */
const storedRemotely = !/localhost|127\.0\.0\.1/.test(envValue('SUPABASE_URL', '')) && envValue('STORAGE_DRIVER', '') === 'supabase';

const fileStored = async (url) => {
  if (!url) return false;
  if (!storedRemotely) return existsSync(join(UPLOADS, ...url.split('/uploads/')[1].split('/')));
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`);
  return res.status === 200;
};

/**
 * Sells over the gateway webhook — what a real handset reaches. The website's
 * simulator is a sandbox that deliberately writes nothing, so it cannot be
 * used to create the listing this test inspects.
 */
const gatewaySecret = envValue('GATEWAY_SECRET', '');
const secret = gatewaySecret;
const ussdTrail = [];
async function ussd(sessionId, text) {
  if (text !== '') ussdTrail.push(text);
  const res = await fetch(`${API}/ussd${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      sessionId,
      serviceCode: '*920*268#',
      phoneNumber: '+233244100200',
      text: ussdTrail.join('*'),
      networkCode: '62002',
    }).toString(),
  });
  const body = await res.text();
  return { screen: body.substring(4), ended: body.startsWith('END') };
}

console.log('\n1. Selling maize over USSD gives the listing a maize photo');
const sid = `PHOTO-TEST-${Date.now()}`;
let screen;
for (const input of ['', '1', '1357', '1', '1', '1', '7', '650', '1']) {
  screen = await ussd(sid, input);
}
console.log('   confirm screen:', JSON.stringify(screen.screen));
screen = await ussd(sid, '1');
console.log('   final screen:  ', JSON.stringify(screen.screen));
check('USSD flow ends with a published listing', screen.ended && /Code: (\S+)/.test(screen.screen));
check('confirmation mentions the photo', /photo of Maize/.test(screen.screen));
check('final screen fits in 182 chars', screen.screen.length <= 182, `(${screen.screen.length})`);
const ussdCode = screen.screen.match(/Code: (\S+)/)?.[1];

let r = await call('GET', `/listings/${ussdCode}`);
let listing = r.data?.data?.listing;
created.listings.push(listing?.id);
check('listing stores no copied photo', Array.isArray(listing?.images) && listing.images.length === 0, JSON.stringify(listing?.images));
check('cover image is the maize catalogue photo', listing?.coverImage === '/images/produce/maize.jpg', listing?.coverImage);
check('photo source is "catalogue"', listing?.photoSource === 'catalogue', listing?.photoSource);
check('produce photo is a local library path', listing?.produce?.imageUrl === '/images/produce/maize.jpg');

console.log('\n2. Selling by SMS works the same way');
// The inbound-SMS webhook is signed like the gateway's own calls
r = await call('POST', `/sms/inbound${gatewaySecret ? `?secret=${encodeURIComponent(gatewaySecret)}` : ''}`, {
  json: { from: '0244100200', text: 'SELL TOMATO 12 1100' },
});
check('SMS inbound accepted', r.status === 200, JSON.stringify(r.data));
r = await call('GET', '/listings?source=sms&sort=newest&limit=1');
const smsListing = r.data?.data?.[0];
if (smsListing) created.listings.push(smsListing.id);
check('SMS listing is Tomato', smsListing?.produce?.name === 'Tomato', smsListing?.produce?.name);
check('SMS listing shows the tomato photo', smsListing?.coverImage === '/images/produce/tomato.jpg', smsListing?.coverImage);

console.log('\n3. The public feed and the library files');
r = await call('GET', '/listings?limit=24');
const feed = r.data?.data ?? [];
check('every listing in the feed has a cover image', feed.length > 0 && feed.every((l) => l.coverImage), `${feed.filter((l) => !l.coverImage).length} missing`);
const libraryFiles = feed.map((l) => l.coverImage).filter((u) => u.startsWith('/images/'));
check('every library cover exists on disk', libraryFiles.every((u) => existsSync(join(FRONTEND_DIR, 'public', u))));
r = await call('GET', '/reference/categories');
check('all categories have a photo', r.data.data.every((c) => c.imageUrl?.startsWith('/images/categories/')));
r = await call('GET', '/reference/produce');
check('all 48 produce types have a photo', r.data.data.length === 48 && r.data.data.every((p) => p.imageUrl?.startsWith('/images/produce/')));

console.log('\n4. The farmer adds and removes their own photos');
const farmer = (await call('POST', '/auth/login', { json: { identifier: 'farmer@agrimart.gh', password: 'Farmer@2026' } })).data.data;
const buyer = (await call('POST', '/auth/login', { json: { identifier: 'buyer@agrimart.gh', password: 'Buyer@2026' } })).data.data;
check('farmer signed in', !!farmer?.token);
const id = listing.id;

r = await call('PATCH', `/listings/${id}`, { token: farmer.token, form: photoForm(2) });
listing = r.data?.data;
check('2 photos added', r.status === 200 && listing?.images?.length === 2, `${r.status} ${r.data?.message}`);
check('response says "2 photos added"', r.data?.message === '2 photos added', r.data?.message);
check('cover is now the farmer\'s photo', listing?.photoSource === 'farmer' && listing.coverImage === listing.images[0]);
const [photoA, photoB] = listing.images;
check('uploaded files are stored', (await fileStored(photoA)) && (await fileStored(photoB)));

r = await call('PATCH', `/listings/${id}`, { token: farmer.token, json: { images: ['https://evil.example/x.jpg'] } });
check('images cannot be set to arbitrary URLs', r.data?.data?.images?.length === 2 && !r.data.data.images.some((u) => u.includes('evil')));

const before = readdirSync(`${UPLOADS}/listings`).length;
r = await call('PATCH', `/listings/${id}`, { token: farmer.token, form: photoForm(4) });
check('more than 5 photos in total is refused', r.status === 400, `${r.status} ${r.data?.message}`);
check('refused upload leaves no files behind', readdirSync(`${UPLOADS}/listings`).length === before);

r = await call('PATCH', `/listings/${id}`, { token: farmer.token, form: photoForm(6) });
check('6 files in one request gives a clear 400', r.status === 400 && /at most 5/.test(r.data?.message), `${r.status} ${r.data?.message}`);
check('that upload also leaves no files behind', readdirSync(`${UPLOADS}/listings`).length === before);

r = await call('PATCH', `/listings/${id}`, { token: buyer.token, form: photoForm(1) });
check('another user cannot add photos', r.status === 403, String(r.status));
check('the stranger\'s upload is discarded', readdirSync(`${UPLOADS}/listings`).length === before);

r = await call('PATCH', `/listings/${id}`, { token: farmer.token, json: { keepImages: [photoB] } });
check('removing one photo keeps the other', r.data?.data?.images?.length === 1 && r.data.data.images[0] === photoB, r.data?.message);
check('removed photo file is deleted', !(await fileStored(photoA)));

r = await call('PATCH', `/listings/${id}`, { token: farmer.token, json: { keepImages: [] } });
listing = r.data?.data;
check('removing all photos falls back to the catalogue photo', listing?.photoSource === 'catalogue' && listing.coverImage === '/images/produce/maize.jpg');
check('last photo file is deleted', !(await fileStored(photoB)));

console.log('\n5. Admins replace and restore a catalogue photo');
const admin = (await call('POST', '/auth/admin/login', { json: { identifier: 'admin@agrimart.gh', password: 'Admin@2026' } })).data.data;
check('admin signed in', !!admin?.token);
const maize = (await call('GET', '/reference/produce/maize')).data.data;

const one = () => { const f = new FormData(); f.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'maize-new.jpg'); return f; };
r = await call('POST', `/reference/produce/${maize.id}/image`, { token: farmer.token, form: one() });
check('farmers cannot change catalogue photos', r.status === 403, String(r.status));

r = await call('POST', `/reference/produce/${maize.id}/image`, { token: admin.token, form: one() });
const custom = r.data?.data?.imageUrl;
check('admin upload succeeds', r.status === 200 && /\/uploads\/catalog\//.test(custom), `${r.status} ${custom}`);
check('uploaded catalogue file is stored', !!custom && (await fileStored(custom)));
r = await call('GET', `/listings/${ussdCode}`);
check('USSD listing now shows the new photo (live fallback)', r.data.data.listing.coverImage === custom);

r = await call('PATCH', `/reference/produce/${maize.id}`, { token: admin.token, json: { imageUrl: 'https://evil.example/x.jpg' } });
check('imageUrl cannot be set as free text', r.data?.data?.imageUrl === custom, r.data?.data?.imageUrl);

r = await call('DELETE', `/reference/produce/${maize.id}/image`, { token: admin.token });
check('reset restores the library photo', r.data?.data?.imageUrl === '/images/produce/maize.jpg', r.data?.data?.imageUrl);
check('replaced upload is deleted', !(await fileStored(custom)));
r = await call('GET', `/listings/${ussdCode}`);
check('listing is back on the library photo', r.data.data.listing.coverImage === '/images/produce/maize.jpg');

r = await call('POST', `/reference/categories/${maize.categoryId}/image`, { token: admin.token, form: one() });
const catCustom = r.data?.data?.imageUrl;
check('category photo upload works', /\/uploads\/catalog\//.test(catCustom ?? ''));
r = await call('DELETE', `/reference/categories/${maize.categoryId}/image`, { token: admin.token });
check('category photo reset works', r.data?.data?.imageUrl === '/images/categories/cereals-grains.jpg', r.data?.data?.imageUrl);
check('category upload file is deleted', !!catCustom && !(await fileStored(catCustom)));

// the listings this suite published over the gateway
if (created.listings.filter(Boolean).length) {
  const ids = created.listings.filter(Boolean).join(',');
  sql(`DELETE FROM favorites WHERE ${col('listingId')} IN (${ids})`);
  sql(`DELETE FROM offers WHERE ${col('listingId')} IN (${ids})`);
  sql(`DELETE FROM orders WHERE ${col('listingId')} IN (${ids})`);
  sql(`DELETE FROM listings WHERE id IN (${ids})`);
}
sql(`DELETE FROM ussd_sessions WHERE ${col('sessionId')} LIKE 'PHOTO-TEST-%'`);
console.log('\n  test rows removed');

t.done();
