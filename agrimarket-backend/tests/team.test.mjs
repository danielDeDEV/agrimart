import { suite, API, sql, col } from './helpers.mjs';

const t = suite('Admin team — who may add, edit and remove administrators');
const check = (...args) => t.check(...args);
// Adding, editing and removing administrators from the Admin team.

async function call(method, path, { token, json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: json ? JSON.stringify(json) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* none */ }
  return { status: res.status, data, message: data?.message };
}
const login = async (identifier, password) =>
  (await call('POST', '/auth/admin/login', { json: { identifier, password } })).data?.data;

const superAdmin = await login('admin@agrimart.gh', 'Admin@2026');
const admin = await login('akua.boakye@agrimart.gh', 'Admin@2026');
check('super administrator signed in', !!superAdmin?.token);

console.log('\n1. What the team page is told');
let r = await call('GET', '/admin/team', { token: superAdmin.token });
check('super administrator may manage the team', r.data?.data?.canManage === true, JSON.stringify(r.data?.data?.canManage));
const members = r.data?.data?.members ?? r.data?.data?.team ?? [];
check('the team lists members', members.length > 0, JSON.stringify(Object.keys(r.data?.data ?? {})));
check('and may appoint super administrators', r.data?.data?.canManageSuperadmins === true, JSON.stringify(r.data?.data?.canManageSuperadmins));
r = await call('GET', '/admin/team', { token: admin.token });
check('a plain administrator may manage the team too', r.data?.data?.canManage === true, JSON.stringify(r.data?.data?.canManage));
check('but not super administrator accounts', r.data?.data?.canManageSuperadmins === false, JSON.stringify(r.data?.data?.canManageSuperadmins));

console.log('\n2. Adding then removing an administrator');
const email = `temp.admin.${Date.now()}@agrimart.gh`;
r = await call('POST', '/admin/team', {
  token: superAdmin.token,
  json: { fullName: 'Temp Admin', email, phone: `05${Date.now().toString().slice(-8)}`, role: 'admin' },
});
const created = r.data?.data?.member ?? r.data?.data?.user ?? r.data?.data;
check('the super administrator can add an administrator', r.status === 201 && !!created?.id, `${r.status} ${r.message}`);

r = await call('PATCH', `/admin/team/${created.id}`, { token: admin.token, json: { fullName: 'Temp Admin Renamed' } });
check('a plain administrator can edit a fellow administrator', r.status === 200, `${r.status} ${r.message}`);
r = await call('POST', `/admin/team/${created.id}/reset-password`, { token: admin.token });
check('and reset their password', r.status === 200, `${r.status} ${r.message}`);
r = await call('DELETE', `/admin/team/${created.id}`, { token: admin.token });
check('and remove them', r.status === 200, `${r.status} ${r.message}`);
check('they lose admin access', sql(`SELECT COUNT(*) FROM users WHERE id=${created.id} AND ${col('deletedAt')} IS NULL`) === '0');

console.log('\n3. The protections');
r = await call('DELETE', `/admin/team/${superAdmin.user.id}`, { token: admin.token });
check('an administrator cannot remove the super administrator', r.status === 403, `${r.status} ${r.message}`);
r = await call('PATCH', `/admin/team/${superAdmin.user.id}`, { token: admin.token, json: { role: 'admin' } });
check('nor demote them', r.status === 403, `${r.status} ${r.message}`);
r = await call('PATCH', `/admin/team/${superAdmin.user.id}`, { token: admin.token, json: { fullName: 'Renamed Owner' } });
check('nor edit their details', r.status === 403, `${r.status} ${r.message}`);
r = await call('DELETE', `/admin/team/${superAdmin.user.id}`, { token: superAdmin.token });
check('a super administrator cannot be removed directly', r.status === 400 || r.status === 403, `${r.status} ${r.message}`);

const second = `second.super.${Date.now()}@agrimart.gh`;
r = await call('POST', '/admin/team', {
  token: admin.token,
  json: { fullName: 'Sneaky Super', email: `sneaky.${Date.now()}@agrimart.gh`, phone: `05${(Date.now() + 2).toString().slice(-8)}`, role: 'superadmin' },
});
check('an administrator cannot appoint a super administrator', r.status === 403, `${r.status} ${r.message}`);

r = await call('POST', '/admin/team', {
  token: superAdmin.token,
  json: { fullName: 'Second Super', email: second, phone: `05${(Date.now() + 1).toString().slice(-8)}`, role: 'superadmin' },
});
const other = r.data?.data?.member ?? r.data?.data?.user ?? r.data?.data;
check('a second super administrator can be added', r.status === 201 && !!other?.id, `${r.status} ${r.message}`);

r = await call('PATCH', `/admin/team/${other.id}`, { token: superAdmin.token, json: { role: 'admin' } });
check('demoting them to admin works', r.status === 200, `${r.status} ${r.message}`);
r = await call('DELETE', `/admin/team/${other.id}`, { token: superAdmin.token });
check('and then they can be removed', r.status === 200, `${r.status} ${r.message}`);

// tidy up anything left behind
sql(`DELETE FROM audit_logs WHERE description LIKE '%Temp Admin%' OR description LIKE '%Second Super%' OR description LIKE '%Sneaky Super%'`);
sql(`DELETE FROM sms_messages WHERE message LIKE '%Temp Admin%' OR message LIKE '%Second Super%'`);
sql(`DELETE FROM users WHERE email IN ('${email}','${second}') OR email LIKE 'sneaky.%@agrimart.gh'`);
console.log('\n  test rows removed');

t.done();
