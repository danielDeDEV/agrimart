import { suite, API, sql, col, idList } from './helpers.mjs';

const t = suite('Users — deleting a seller account and what it tidies up');
const check = (...args) => t.check(...args);
// Deleting a seller account: who may, when it is refused, and what it tidies up.

async function call(method, path, { token, json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: json ? JSON.stringify(json) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* none */ }
  return { status: res.status, data, message: data?.message };
}
const login = async (identifier, password, admin = false) =>
  (await call('POST', admin ? '/auth/admin/login' : '/auth/login', { json: { identifier, password } })).data?.data;

const superAdmin = await login('admin@agrimart.gh', 'Admin@2026', true);
const admin = await login('akua.boakye@agrimart.gh', 'Admin@2026', true);
const buyer = await login('buyer@agrimart.gh', 'Buyer@2026');

console.log('\n1. A seller with produce on the marketplace');
const phone = `05${Date.now().toString().slice(-8)}`;
let r = await call('POST', '/admin/users', {
  token: superAdmin.token,
  json: { fullName: 'Doomed Seller', phone, role: 'farmer', regionId: 1, password: 'Seller@2026' },
});
const seller = r.data?.data?.user;
check('seller account created', !!seller?.id, JSON.stringify(r.message));

const sellerToken = (await login(phone, 'Seller@2026'))?.token;
r = await call('POST', '/listings', {
  token: sellerToken,
  json: { produceId: 1, quantity: 10, unit: 'bag (100kg)', pricePerUnit: 700, minOrderQuantity: 1 },
});
const listing = r.data?.data;
check('seller lists produce', !!listing?.code, JSON.stringify(r.message));
r = await call('GET', `/listings/${listing.code}`);
check('buyers can see it', r.status === 200);

console.log('\n2. An open order blocks deletion');
r = await call('POST', '/orders', { token: buyer.token, json: { listingId: listing.id, quantity: 1 } });
const order = r.data?.data;
check('buyer orders from them', !!order?.code, JSON.stringify(r.message));
r = await call('DELETE', `/admin/users/${seller.id}`, { token: superAdmin.token });
check('deletion is refused while an order is open', r.status === 400 && /open order/i.test(r.message || ''), `${r.status} ${r.message}`);

r = await call('PATCH', `/orders/${order.id}/status`, { token: buyer.token, json: { status: 'cancelled', reason: 'Testing' } });
check('the order is settled', r.data?.data?.status === 'cancelled', JSON.stringify(r.message));

console.log('\n3. Who may delete');
r = await call('DELETE', `/admin/users/${superAdmin.user.id}`, { token: admin.token });
check('an administrator cannot delete the super administrator', r.status === 403, String(r.status));
r = await call('DELETE', `/admin/users/${superAdmin.user.id}`, { token: superAdmin.token });
check('the super administrator cannot delete themselves', r.status === 400, String(r.status));

console.log('\n4. A plain administrator deletes the seller');
r = await call('DELETE', `/admin/users/${seller.id}`, { token: admin.token });
check('deletion succeeds', r.status === 200, `${r.status} ${r.message}`);
check('and says what it tidied up', /listing/i.test(r.message || ''), r.message);
check('their listing is withdrawn', sql(`SELECT status FROM listings WHERE id=${listing.id}`) === 'withdrawn', sql(`SELECT status FROM listings WHERE id=${listing.id}`));

r = await call('GET', `/listings/${listing.code}`);
check('the listing page is gone for buyers', r.status === 404, String(r.status));
r = await call('GET', '/listings?limit=100');
check('and it is out of the marketplace feed', !(r.data?.data ?? []).some((l) => l.id === listing.id));
check('the account no longer appears in the console', !((await call('GET', `/admin/users?search=Doomed`, { token: admin.token })).data?.data ?? []).length);
check('the deletion is in the audit log', /Doomed Seller/.test(sql("SELECT description FROM audit_logs WHERE action='user.delete' ORDER BY id DESC LIMIT 1")));

// tidy up: remove the rows this test made
const ids = sql(`SELECT ${idList()} FROM users WHERE phone='${phone}'`);
sql(`DELETE FROM sms_messages WHERE recipient='${phone}' OR ${col('userId')} IN (${ids || 0})`);
sql(`DELETE FROM notifications WHERE ${col('userId')} IN (${ids || 0})`);
sql(`DELETE FROM orders WHERE id=${order.id}`);
sql(`DELETE FROM listings WHERE id=${listing.id}`);
sql(`DELETE FROM users WHERE phone='${phone}'`);
sql("DELETE FROM audit_logs WHERE description LIKE '%Doomed Seller%'");
console.log('\n  test rows removed');

t.done();
