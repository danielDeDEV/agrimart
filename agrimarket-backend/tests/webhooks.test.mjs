import { suite, API, sql, envValue, cleanupTestRows, col } from './helpers.mjs';

const t = suite("Webhooks — exactly what Africa's Talking posts");
const check = (...args) => t.check(...args);
// Exactly what Africa's Talking posts, against the running API.
const SECRET = envValue('GATEWAY_SECRET', '');
const PHONE = '+233244100200';          // AT sends E.164

/** Posts form-encoded, the way the gateway does. */
async function post(path, fields, { secret = SECRET } = {}) {
  const url = `${API}${path}${secret ? `?secret=${secret}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await res.text();
  return { status: res.status, type: res.headers.get('content-type') || '', text };
}

const RUN = Date.now();
const dr = `ATXid_dr_${RUN}`;
const inbound = `ATXid_in_${RUN}`;
const sessionId = `ATUid_${RUN}`;
const ussd = (text) => post('/ussd', { sessionId, serviceCode: '*920*1234#', phoneNumber: PHONE, text, networkCode: '62002' });

console.log('\n1. USSD callback');
let r = await ussd('');
check('replies 200', r.status === 200, String(r.status));
check('replies as plain text', r.type.includes('text/plain'), r.type);
check('starts with CON', r.text.startsWith('CON '), r.text.slice(0, 40));
check('greets the registered farmer', /AgriMart - Hi/.test(r.text), r.text.split('\n')[0]);

// AT sends the whole trail, joined with *
r = await ussd('2');
check('menu choice moves on', r.text.startsWith('CON ') && !/Hi /.test(r.text.split('\n')[0]), r.text.split('\n')[0]);
r = await ussd('2*1');
check('a full trail is understood', r.text.startsWith('CON '), r.text.slice(0, 60));

console.log('\n2. A PIN of four identical digits is accepted');
const newPhone = `+2335${Date.now().toString().slice(-8)}`;
const reg = `ATUid_reg_${Date.now()}`;
const regStep = (text) => post('/ussd', { sessionId: reg, serviceCode: '*920*1234#', phoneNumber: newPhone, text });
await regStep('');            // welcome
await regStep('1');           // register
await regStep('Kofi Test');   // name
await regStep('1');           // role: farmer
let screen = await regStep('1*Kofi Test*1*1'); // region pick (trail form)
const regBody = screen.text;
// walk the rest of the flow generically until the PIN prompt
let trail = '1*Kofi Test*1*1';
for (let i = 0; i < 6 && !/PIN/i.test(screen.text); i++) {
  trail += '*1';
  screen = await regStep(trail);
}
check('registration reaches the PIN step', /PIN/i.test(screen.text), screen.text.slice(0, 80));
screen = await regStep(`${trail}*1111`);
check('1111 is not rejected', !/less obvious/i.test(screen.text) && /confirm/i.test(screen.text), screen.text.slice(0, 80));
screen = await regStep(`${trail}*1111*1111`);
check('the account is created with that PIN', /Registration successful/i.test(screen.text), screen.text.slice(0, 90));
check('and the farmer lands on the main menu', /Sell Produce/i.test(screen.text), screen.text.slice(0, 90));

console.log('\n3. Delivery reports');
const smsId = sql("SELECT id FROM sms_messages WHERE direction='outbound' ORDER BY id DESC LIMIT 1");
sql(`UPDATE sms_messages SET ${col('providerMessageId')}='${dr}', status='sent', ${col('errorMessage')}=NULL WHERE id=${smsId}`);
r = await post('/sms/delivery-report', { id: dr, status: 'Success', phoneNumber: PHONE, networkCode: '62002' });
check('accepts the receipt', r.status === 200, String(r.status));
check('marks the message delivered', sql(`SELECT status FROM sms_messages WHERE id=${smsId}`) === 'delivered');

sql(`UPDATE sms_messages SET status='sent' WHERE id=${smsId}`);
r = await post('/sms/delivery-report', { id: dr, status: 'Failed', failureReason: 'InsufficientCredit' });
check('marks a failure', sql(`SELECT status FROM sms_messages WHERE id=${smsId}`) === 'failed');
check('stores a readable reason', sql(`SELECT ${col('errorMessage')} FROM sms_messages WHERE id=${smsId}`) === 'Insufficient Credit');
r = await post('/sms/delivery-report', { id: 'ATXid_unknown', status: 'Success' });
check('an unknown id is still accepted', r.status === 200);

console.log('\n4. Incoming SMS');
r = await post('/sms/inbound', { from: PHONE, to: '1234', text: 'PRICE MAIZE', date: '2026-09-19 10:00:00', id: inbound, linkId: 'link-1' });
check('accepts the message', r.status === 200, r.text.slice(0, 60));
const logged = sql(`SELECT COUNT(*) FROM sms_messages WHERE ${col('providerMessageId')}='${inbound}' AND direction='inbound'`);
check('logs it against the farmer', logged === '1', logged);
const reply = sql("SELECT message FROM sms_messages WHERE direction='outbound' ORDER BY id DESC LIMIT 1");
check('replies with maize prices', /maize/i.test(reply), reply.slice(0, 70));

console.log('\n5. The shared secret');
// The server only enforces this when GATEWAY_SECRET is set — which production
// requires and a laptop usually leaves empty.
if (!SECRET) {
  console.log('  skip GATEWAY_SECRET is empty in .env, so the webhooks are open (a production server refuses to start like this)');
} else {
  r = await post('/ussd', { sessionId: 'x', serviceCode: '*920*1234#', phoneNumber: PHONE, text: '' }, { secret: '' });
  check('a call without the secret is refused', r.status === 403, String(r.status));
  r = await post('/ussd', { sessionId: 'x', serviceCode: '*920*1234#', phoneNumber: PHONE, text: '' }, { secret: 'wrong' });
  check('a wrong secret is refused', r.status === 403, String(r.status));
}

// the registration this suite performs is a real account — remove it
cleanupTestRows({ names: ['Kofi Test'], sessionPrefixes: ['ATUid_'] });
console.log('\n  test rows removed');

t.done();
