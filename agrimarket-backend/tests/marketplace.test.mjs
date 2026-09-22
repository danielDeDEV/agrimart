// Marketplace rules that protect the shop window: how many listings one
// farmer may keep open, and that the limit is the same on every channel.
import { suite, call, sql, sqlNumber, login, ACCOUNTS, adminLogin, API, envValue, col } from './helpers.mjs';

const t = suite('Marketplace — listing limits across web, USSD and SMS');
const check = (...args) => t.check(...args);

const superAdmin = await adminLogin(...ACCOUNTS.superAdmin);
check('super administrator signed in', !!superAdmin?.token);

/** The limit lives in Admin → Settings, so the test drives it from there. */
const setLimit = async (value) => {
  const r = await call('PATCH', '/admin/settings', {
    token: superAdmin.token,
    json: { settings: [{ key: 'max_active_listings', value: String(value) }] },
  });
  return r.status === 200;
};

const settings = (await call('GET', '/admin/settings', { token: superAdmin.token })).body;
const rows = Array.isArray(settings) ? settings : settings?.settings ?? [];
const original = rows.find((s) => s.key === 'max_active_listings')?.value ?? '25';
check('the limit is an editable setting', rows.some((s) => s.key === 'max_active_listings'), original);

t.section('1. A seller with room to spare');
const phone = `05${Date.now().toString().slice(-8)}`;
let r = await call('POST', '/admin/users', {
  token: superAdmin.token,
  json: { fullName: 'Limit Test Farmer', phone, role: 'farmer', regionId: 1, password: 'Seller@2026' },
});
const seller = r.body?.user;
check('seller account created', !!seller?.id, r.message);
const sellerToken = (await login(phone, 'Seller@2026'))?.token;

const publish = (quantity) =>
  call('POST', '/listings', {
    token: sellerToken,
    json: { produceId: 1, quantity, unit: 'bag (100kg)', pricePerUnit: 700, minOrderQuantity: 1 },
  });

check('the limit can be set low for the test', await setLimit(2));

r = await publish(10);
const first = r.body;
check('the first listing publishes', r.status === 201 && !!first?.code, `${r.status} ${r.message}`);
r = await publish(11);
const second = r.body;
check('the second publishes too', r.status === 201 && !!second?.code, `${r.status} ${r.message}`);

t.section('2. The limit holds');
r = await publish(12);
check('a third is refused', r.status === 400, String(r.status));
check('and the message says what to do', /most allowed|sold or remove/i.test(r.message || ''), r.message);
check('nothing extra was stored', sqlNumber(`SELECT COUNT(*) FROM listings WHERE ${col('farmerId')}=${seller.id}`) === 2);

t.section('3. Closing one makes room again');
r = await call('PATCH', `/listings/${first.id}`, { token: sellerToken, json: { status: 'sold' } });
check('the farmer marks one as sold', r.status === 200, `${r.status} ${r.message}`);
r = await publish(13);
check('a new listing is accepted', r.status === 201, `${r.status} ${r.message}`);
const third = r.body;

t.section('4. USSD obeys the same limit');
// Back to the ceiling, then sell over the gateway the way a handset does
check('the limit is reached again', (await publish(14)).status === 400);

const sessionId = `LIMIT-TEST-${Date.now()}`;
const trail = [];
const dial = async (key) => {
  if (key !== '') trail.push(key);
  const secret = envValue('GATEWAY_SECRET', '');
  const res = await fetch(`${API}/ussd${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      sessionId,
      serviceCode: '*920*268#',
      phoneNumber: `+233${phone.slice(1)}`,
      text: trail.join('*'),
      networkCode: '62002',
    }).toString(),
  });
  return res.text();
};

await dial('');
let screen = '';
for (const key of ['1', '1234', '1', '1', '1', '5', '600', '1', '1']) {
  screen = await dial(key);
  if (screen.startsWith('END')) break;
}
check('the USSD seller is stopped too', /most allowed|sold or remove|could not publish/i.test(screen), screen.slice(4, 120));
check('no extra listing appeared', sqlNumber(`SELECT COUNT(*) FROM listings WHERE ${col('farmerId')}=${seller.id}`) === 3);

t.section('5. Zero means no limit');
check('the limit can be switched off', await setLimit(0));
r = await publish(15);
check('publishing is unrestricted again', r.status === 201, `${r.status} ${r.message}`);

// put the platform back exactly as it was
await setLimit(original);
sql(`DELETE FROM sms_messages WHERE ${col('userId')}=${seller.id} OR recipient='${phone}'`);
sql(`DELETE FROM notifications WHERE ${col('userId')}=${seller.id}`);
sql(`DELETE FROM ussd_sessions WHERE ${col('sessionId')}='${sessionId}' OR phone='${phone}'`);
sql(`DELETE FROM listings WHERE ${col('farmerId')}=${seller.id}`);
sql(`DELETE FROM audit_logs WHERE description LIKE '%Limit Test Farmer%'`);
sql(`DELETE FROM users WHERE id=${seller.id}`);
check('the setting is back to what it was', String(original) === String(
  (await call('GET', '/admin/settings', { token: superAdmin.token })).body?.find?.((s) => s.key === 'max_active_listings')?.value
  ?? original
));
console.log('\n  test rows removed');

void third;
t.done();
