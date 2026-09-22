import { suite, call, sql, sqlNumber, DEMO_USSD_PHONE, DEMO_USSD_PIN, col } from './helpers.mjs';

const t = suite('USSD — the website simulator is a sandbox');
// The website's phone simulator must never touch real data or send real SMS.
const check = (...args) => t.check(...args);
const post = async (path, json) => {
  const r = await call('POST', path, { json });
  return { status: r.status, ...(r.body ?? {}), message: r.message };
};

/** Walks the simulator through a list of keypresses and returns the last screen. */
async function dial(phone, keys) {
  const sessionId = `SIM-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let last = await post('/ussd/simulate', { sessionId, phoneNumber: phone, text: '' });
  for (const key of keys) {
    if (last.ended) break;
    last = await post('/ussd/simulate', { sessionId, phoneNumber: phone, text: key });
  }
  return last;
}

const countUsers = () => sqlNumber('SELECT COUNT(*) FROM users');
const countListings = () => sqlNumber('SELECT COUNT(*) FROM listings');
const countSms = () => sqlNumber('SELECT COUNT(*) FROM sms_messages');
const countTickets = () => sqlNumber('SELECT COUNT(*) FROM support_tickets');

const before = { users: countUsers(), listings: countListings(), sms: countSms(), tickets: countTickets() };
console.log(`before: ${before.users} users, ${before.listings} listings, ${before.sms} sms, ${before.tickets} tickets\n`);

console.log('1. A real account cannot be opened from the website');
const realPhone = sql(`SELECT phone FROM users WHERE role='farmer' AND phone NOT IN ('${DEMO_USSD_PHONE}','0244200300') AND ${col('deletedAt')} IS NULL LIMIT 1`);
let r = await dial(realPhone, []);
check('the simulator refuses a registered number', /registered account/i.test(r.screen || ''), r.screen);
check('and ends the session there', r.ended === true, String(r.ended));

console.log('\n2. Registration writes nothing');
const strangerPhone = `059${Date.now().toString().slice(-7)}`;
r = await dial(strangerPhone, ['1', 'Kofi Demo Tester', '1', '1', '1', 'Demo Village', '1357', '1357']);
check('the flow reaches a closing screen', r.ended === true, JSON.stringify(r.screen)?.slice(0, 120));
check('it says nothing was saved', /demo/i.test(r.screen || '') && /nothing was saved/i.test(r.screen || ''), r.screen);
check('no account was created', countUsers() === before.users, `${countUsers()} vs ${before.users}`);
check('no welcome SMS was queued', countSms() === before.sms, `${countSms()} vs ${before.sms}`);

console.log('\n3. The demo account can browse but not write');
r = await dial(DEMO_USSD_PHONE, ['1', DEMO_USSD_PIN]);
check('the demo farmer reaches the PIN gate', /PIN/i.test(r.screen || '') || /selling/i.test(r.screen || ''), r.screen?.slice(0, 80));

r = await dial(DEMO_USSD_PHONE, ['1', DEMO_USSD_PIN, '1', '1', '1', '10', '500', '1', '1']);
check('a listing ends in a demo confirmation', /nothing was saved/i.test(r.screen || ''), r.screen?.slice(0, 160));
check('no listing was published', countListings() === before.listings, `${countListings()} vs ${before.listings}`);

console.log('\n4. Support reports are not filed either');
r = await dial(DEMO_USSD_PHONE, ['7', '4', 'The demo test message']);
check('the report ends in a demo confirmation', /nothing was saved/i.test(r.screen || ''), r.screen?.slice(0, 160));
check('no ticket was created', countTickets() === before.tickets, `${countTickets()} vs ${before.tickets}`);

console.log('\n5. Nothing at all was sent');
check('the SMS centre is untouched', countSms() === before.sms, `${countSms()} vs ${before.sms}`);

// the only rows a simulated session may leave behind are its own session records
const sessions = sqlNumber(`SELECT COUNT(*) FROM ussd_sessions WHERE ${col('sessionId')} LIKE 'SIM-TEST-%'`);
check('simulator sessions are flagged as simulated', sqlNumber(`SELECT COUNT(*) FROM ussd_sessions WHERE ${col('sessionId')} LIKE 'SIM-TEST-%' AND ${col('isSimulated')} = TRUE`) === sessions, String(sessions));
sql(`DELETE FROM ussd_sessions WHERE ${col('sessionId')} LIKE 'SIM-TEST-%'`);
console.log('\n  simulator sessions cleared');

t.done();
