import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { suite, API, sql, cleanupTestRows, BACKEND_DIR, FRONTEND_DIR, col } from './helpers.mjs';

const t = suite('Orders — payment evidence, complaints and managing people');
const check = (...args) => t.check(...args);
// Payment evidence, complaints with screenshots, and the user-management rules.
const UPLOADS = join(BACKEND_DIR, 'uploads');
const JPEG = readFileSync(join(FRONTEND_DIR, 'public/images/produce/tomato.jpg'));

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(API + path, { method, headers, body });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data, message: data?.message };
}

const login = async (identifier, password, admin = false) =>
  (await call('POST', admin ? '/auth/admin/login' : '/auth/login', { json: { identifier, password } })).data?.data;

const evidenceForm = (fields, count = 1) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
  for (let i = 0; i < count; i++) f.append('attachments', new Blob([JPEG], { type: 'image/jpeg' }), `proof-${i}.jpg`);
  return f;
};
const onDisk = (url) => existsSync(join(UPLOADS, ...url.split('/uploads/')[1].split('/')));

const started = sql('SELECT NOW()');
const created = { orders: [], tickets: [], users: [] };

console.log('\n1. Signing in');
const buyer = await login('buyer@agrimart.gh', 'Buyer@2026');
const farmer = await login('farmer@agrimart.gh', 'Farmer@2026');
const superAdmin = await login('admin@agrimart.gh', 'Admin@2026', true);
const admin = await login('akua.boakye@agrimart.gh', 'Admin@2026', true);
check('buyer, farmer, super admin and admin all signed in', !!(buyer?.token && farmer?.token && superAdmin?.token && admin?.token));

console.log('\n2. An order, paid outside the platform');
const listings = (await call('GET', `/listings?farmerId=${farmer.user.id}&limit=1`)).data?.data ?? [];
check('the demo farmer has a live listing', listings.length === 1, JSON.stringify(listings.length));
const listing = listings[0];

let r = await call('POST', '/orders', {
  token: buyer.token,
  json: { listingId: listing.id, quantity: Math.max(1, Number(listing.minOrderQuantity)), paymentMethod: 'momo', deliveryMethod: 'pickup' },
});
const order = r.data?.data;
if (order) created.orders.push(order.id);
check('buyer places an order', r.status === 201 && !!order?.code, JSON.stringify(r.data?.message));

r = await call('PATCH', `/orders/${order.id}/status`, { token: farmer.token, json: { status: 'accepted' } });
check('farmer accepts it', r.data?.data?.status === 'accepted', JSON.stringify(r.data?.message));

console.log('\n3. The buyer records what they paid');
r = await call('POST', `/orders/${order.id}/payment`, {
  token: buyer.token,
  form: evidenceForm({ reference: 'MP260920.1423.A12345', method: 'momo', note: 'Sent from 0244123456' }, 2),
});
let updated = r.data?.data;
check('payment recorded', r.status === 200, JSON.stringify(r.data?.message));
check('reference and method stored', updated?.paymentProof?.reference === 'MP260920.1423.A12345' && updated.paymentProof.method === 'momo');
check('both screenshots stored', updated?.paymentProof?.images?.length === 2, JSON.stringify(updated?.paymentProof?.images));
check('screenshot files are on disk', (updated?.paymentProof?.images ?? []).every(onDisk));
check('it is not marked paid until the farmer confirms', updated?.paymentStatus === 'pending' && updated.status === 'accepted', `${updated?.paymentStatus}/${updated?.status}`);
check('the farmer is told what to look for', /says they paid/i.test(sql(`SELECT message FROM sms_messages WHERE ${col('relatedId')}=${order.id} AND type='payment' ORDER BY id DESC LIMIT 1`)));

r = await call('POST', `/orders/${order.id}/payment`, { token: farmer.token, form: evidenceForm({ reference: 'X' }) });
check('the farmer cannot record the buyer\'s payment', r.status === 403, String(r.status));

r = await call('PATCH', `/orders/${order.id}/status`, { token: buyer.token, json: { status: 'paid' } });
check('the buyer cannot mark it paid themselves', r.status === 403, String(r.status));

r = await call('PATCH', `/orders/${order.id}/status`, { token: farmer.token, json: { status: 'paid', note: 'Money received' } });
check('the farmer confirms the money arrived', r.data?.data?.status === 'paid' && r.data.data.paymentStatus === 'paid', JSON.stringify(r.data?.message));

console.log('\n4. Reporting a problem with screenshots');
r = await call('POST', `/orders/${order.id}/report`, {
  token: buyer.token,
  form: evidenceForm({ category: 'payment', message: 'I paid GHS 650 by MoMo but the farmer says nothing arrived. Screenshot attached.' }, 1),
});
const ticketCode = r.data?.data?.ticket?.code;
check('the report opens a ticket', r.status === 201 && !!ticketCode, JSON.stringify(r.data?.message));
check('the order is put on hold', r.data?.data?.order?.status === 'disputed', r.data?.data?.order?.status);
const ticketRow = sql(`SELECT CONCAT(id,'|',${col('orderId')},'|',category,'|',attachments) FROM support_tickets WHERE code='${ticketCode}'`);
if (ticketRow) created.tickets.push(ticketRow.split('|')[0]);
check('the ticket points at the order', ticketRow.split('|')[1] === String(order.id), ticketRow);
check('the screenshot is attached to the ticket', /uploads\/evidence/.test(ticketRow), ticketRow);

r = await call('POST', `/orders/${order.id}/report`, { token: admin.token, form: evidenceForm({ message: 'Not my order at all, just testing' }) });
check('someone outside the order cannot report it', r.status === 403, String(r.status));

console.log('\n5. What the support desk sees');
r = await call('GET', '/admin/support?limit=5', { token: admin.token });
const ticket = (r.data?.data ?? []).find((t) => t.code === ticketCode);
check('the ticket is in the desk', !!ticket);
check('with its screenshots', (ticket?.attachments ?? []).length === 1, JSON.stringify(ticket?.attachments));
check('with the order attached', ticket?.order?.code === order.code, JSON.stringify(ticket?.order?.code));
check('and the payment evidence on that order', (ticket?.order?.paymentProof?.images ?? []).length === 2);

console.log('\n6. Managing people');
const phone = `05${Date.now().toString().slice(-8)}`;
r = await call('POST', '/admin/users', {
  token: admin.token,
  json: { fullName: 'Field Test Farmer', phone, role: 'farmer', regionId: 1 },
});
const newUser = r.data?.data?.user;
if (newUser) created.users.push(newUser.id);
check('an admin can add a user', r.status === 201 && !!newUser?.id, JSON.stringify(r.data?.message));
check('and gets a one-time password to hand over', !!r.data?.data?.temporaryPassword);

r = await call('POST', '/admin/users', { token: admin.token, json: { fullName: 'Second Admin', phone: `05${(Date.now() + 1).toString().slice(-8)}`, role: 'admin' } });
const secondAdmin = r.data?.data?.user;
if (secondAdmin) created.users.push(secondAdmin.id);
check('an admin can appoint another admin', r.status === 201 && !!secondAdmin?.id, `${r.status} ${JSON.stringify(r.data?.message)}`);

r = await call('POST', '/admin/users', { token: admin.token, json: { fullName: 'Sneaky Super', phone: `05${(Date.now() + 2).toString().slice(-8)}`, role: 'superadmin' } });
check('but cannot appoint a super administrator', r.status === 403, String(r.status));

r = await call('PATCH', `/admin/users/${farmer.user.id}`, { token: admin.token, json: { status: 'suspended', suspendedReason: 'Testing suspension' } });
check('an admin can suspend a seller', r.data?.data?.status === 'suspended', JSON.stringify(r.data?.message));
check('the seller is told why, on the new support line', /suspended/i.test(sql(`SELECT message FROM sms_messages WHERE recipient='${farmer.user.phone}' ORDER BY id DESC LIMIT 1`)));

r = await call('GET', `/listings?farmerId=${farmer.user.id}`);
check('a suspended seller\'s produce leaves the marketplace', (r.data?.data ?? []).length === 0, `${(r.data?.data ?? []).length} still listed`);
r = await call('GET', `/listings/${listing.code}`);
check('and their listing page is closed to buyers', r.status === 404, String(r.status));
r = await call('GET', `/listings/${listing.code}`, { token: admin.token });
check('but staff can still open it to investigate', r.status === 200, String(r.status));
r = await call('POST', '/auth/login', { json: { identifier: 'farmer@agrimart.gh', password: 'Farmer@2026' } });
check('and the suspended seller cannot sign in', r.status === 403 && /suspended/i.test(r.message || ''), `${r.status} ${r.message}`);

r = await call('PATCH', `/admin/users/${farmer.user.id}`, { token: admin.token, json: { status: 'active' } });
check('reinstating brings the produce back', r.data?.data?.status === 'active');
r = await call('GET', `/listings?farmerId=${farmer.user.id}`);
check('the listing is public again', (r.data?.data ?? []).length > 0, `${(r.data?.data ?? []).length}`);

console.log('\n7. Who may remove whom');
r = await call('DELETE', `/admin/users/${newUser.id}`, { token: admin.token });
check('a plain admin can delete a seller account', r.status === 200, `${r.status} ${JSON.stringify(r.data?.message)}`);
if (r.status === 200) created.users = created.users.filter((id) => id !== newUser.id);

r = await call('DELETE', `/admin/team/${secondAdmin.id}`, { token: admin.token });
check('and can remove a fellow administrator', r.status === 200, `${r.status} ${JSON.stringify(r.data?.message)}`);
if (r.status === 200) created.users = created.users.filter((id) => id !== secondAdmin.id);

r = await call('DELETE', `/admin/team/${superAdmin.user.id}`, { token: admin.token });
check('an admin cannot remove the super admin', r.status === 403, String(r.status));
r = await call('PATCH', `/admin/team/${superAdmin.user.id}`, { token: admin.token, json: { status: 'suspended' } });
check('nor suspend them', r.status === 403, String(r.status));
r = await call('DELETE', `/admin/users/${superAdmin.user.id}`, { token: admin.token });
check('nor reach them through the users page', r.status === 403, String(r.status));
r = await call('DELETE', `/admin/users/${superAdmin.user.id}`, { token: superAdmin.token });
check('and the super admin cannot delete themselves', r.status === 400, String(r.status));

// leave the database as we found it: the accounts this suite registered, and
// the order and ticket it raised against the seeded demo accounts
cleanupTestRows({ names: ['Field Test Farmer', 'Second Admin', 'Sneaky Super'] });
if (created.tickets.length) sql(`DELETE FROM support_tickets WHERE id IN (${created.tickets.join(',')})`);
if (created.orders.length) {
  const ids = created.orders.join(',');
  sql(`DELETE FROM transactions WHERE ${col('orderId')} IN (${ids})`);
  sql(`DELETE FROM reviews WHERE ${col('orderId')} IN (${ids})`);
  sql(`DELETE FROM support_tickets WHERE ${col('orderId')} IN (${ids})`);
  sql(`DELETE FROM notifications WHERE ${col('relatedId')} IN (${ids}) AND ${col('relatedType')}='order'`);
  sql(`DELETE FROM orders WHERE id IN (${ids})`);
}
console.log('\n  test rows removed');

t.done();
