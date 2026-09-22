import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { suite, API, sql, FRONTEND_DIR, col, isPostgres } from './helpers.mjs';

const t = suite('Support — the contact form, with and without screenshots');
const check = (...args) => t.check(...args);
// The general support form, with and without screenshots.
const JPEG = readFileSync(join(FRONTEND_DIR, 'public/images/produce/okra.jpg'));

const login = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'buyer@agrimart.gh', password: 'Buyer@2026' }),
}).then((r) => r.json());
const token = login?.data?.token;

const form = new FormData();
form.append('category', 'payment');
form.append('subject', 'Screenshot test ticket');
form.append('message', 'Attaching a screenshot of the mobile money message for review.');
form.append('attachments', new Blob([JPEG], { type: 'image/jpeg' }), 'momo.jpg');

let res = await fetch(`${API}/support`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
let body = await res.json();
const code = body?.data?.code;
check('ticket with a screenshot is accepted', res.status === 201 && !!code, JSON.stringify(body).slice(0, 120));
const row = code ? sql(`SELECT CONCAT(id,'|',attachments) FROM support_tickets WHERE code='${code}'`) : '';
check('the screenshot is stored on the ticket', /uploads\/evidence/.test(row), row);

// plain JSON must still work for the public contact form
res = await fetch(`${API}/support`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Visitor', phone: '0244100200', subject: 'No screenshot', message: 'Just a plain question about selling maize.' }),
});
body = await res.json();
check('the plain contact form still works', res.status === 201 && !!body?.data?.code, JSON.stringify(body).slice(0, 120));

// tidy up
const codes = [code, body?.data?.code].filter(Boolean).map((c) => `'${c}'`).join(',');
if (codes) sql(`DELETE FROM support_tickets WHERE code IN (${codes})`);
sql(`DELETE FROM sms_messages WHERE type='support' AND ${col('createdAt')} >= NOW() - ${isPostgres ? "INTERVAL '5 minutes'" : 'INTERVAL 5 MINUTE'}`);
t.done();
