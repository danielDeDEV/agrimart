import { suite, API, cleanupTestRows } from './helpers.mjs';

const t = suite('Permissions — the whole rule set for administrator accounts');
// The full permission rules for administrator accounts, against the live API.
const base = API;

async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, message: json.message, data: json.data };
}

/** Asserts the status code, and shows the API's own message either way. */
function expect(label, res, ...want) {
  t.check(`${label} [${res.status}] ${res.message ?? ''}`.trim(), want.includes(res.status));
  return res;
}


const sa = await call('POST', '/auth/admin/login', null, { identifier: 'admin@agrimart.gh', password: 'Admin@2026' });
const ak = await call('POST', '/auth/admin/login', null, { identifier: 'akua.boakye@agrimart.gh', password: 'Admin@2026' });
const fm = await call('POST', '/auth/login', null, { identifier: 'farmer@agrimart.gh', password: 'Farmer@2026' });
const SA = sa.data.token;
const AK = ak.data.token;
const saId = sa.data.user.id;
const akId = ak.data.user.id;
const farmerId = fm.data.user.id;
console.log(`super admin #${saId} (${sa.data.user.role}), admin #${akId} (${ak.data.user.role}), farmer #${farmerId}`);

console.log('== the owner account is protected from other administrators ==');
const view = expect('admin can view the team', await call('GET', '/admin/team', AK), 200);
console.log(`    ${view.data?.members?.length} members, canManage=${view.data?.canManage}`);
expect('admin cannot appoint a super administrator', await call('POST', '/admin/team', AK, { fullName: 'Sneaky Super', email: 'sneaky@agrimart.gh', phone: '0244999002', role: 'superadmin' }), 403);
expect('admin deletes super admin (team)', await call('DELETE', `/admin/team/${saId}`, AK), 403);
expect('admin deletes super admin (users)', await call('DELETE', `/admin/users/${saId}`, AK), 403);
expect('admin suspends super admin (users)', await call('PATCH', `/admin/users/${saId}`, AK, { status: 'suspended', suspendedReason: 'x' }), 403);
expect('admin demotes super admin (users)', await call('PATCH', `/admin/users/${saId}`, AK, { role: 'farmer' }), 403);
expect('admin edits super admin (team)', await call('PATCH', `/admin/team/${saId}`, AK, { fullName: 'Hacked' }), 403);
expect('admin promotes a farmer to super admin (users)', await call('PATCH', `/admin/users/${farmerId}`, AK, { role: 'superadmin' }), 403);
expect('admin resets super admin password', await call('POST', `/admin/team/${saId}/reset-password`, AK), 403);

console.log('== super admin cannot lock themselves out ==');
expect('super admin demotes self', await call('PATCH', `/admin/team/${saId}`, SA, { role: 'admin' }), 400);
expect('super admin suspends self', await call('PATCH', `/admin/team/${saId}`, SA, { status: 'suspended' }), 400);
expect('super admin removes self', await call('DELETE', `/admin/team/${saId}`, SA), 400);
expect('super admin resets own password via team', await call('POST', `/admin/team/${saId}/reset-password`, SA), 400);

console.log('== super admin manages an administrator ==');
const created = expect('add administrator (generated password)', await call('POST', '/admin/team', SA, { fullName: 'Test Administrator', email: 'test.admin@agrimart.gh', phone: '0244999001', role: 'admin' }), 201);
const newId = created.data?.member?.id;
const temp1 = created.data?.temporaryPassword;
console.log(`    temporary password issued: ${Boolean(temp1)} (${temp1?.length} chars)`);
expect('new admin signs in with it', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp1 }), 200);
expect('duplicate email refused', await call('POST', '/admin/team', SA, { fullName: 'Duplicate', email: 'test.admin@agrimart.gh', phone: '0244999003' }), 409);
expect('promote to super administrator', await call('PATCH', `/admin/team/${newId}`, SA, { role: 'superadmin' }), 200);
expect('remove while super admin is refused', await call('DELETE', `/admin/team/${newId}`, SA), 403);
expect('change back to administrator', await call('PATCH', `/admin/team/${newId}`, SA, { role: 'admin' }), 200);
expect('edit details', await call('PATCH', `/admin/team/${newId}`, SA, { fullName: 'Test Administrator Two' }), 200);

const reset = expect('reset password', await call('POST', `/admin/team/${newId}/reset-password`, SA), 200);
const temp2 = reset.data?.temporaryPassword;
expect('old password no longer works', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp1 }), 401);
const relog = expect('new password works', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp2 }), 200);
const NT = relog.data?.token;
expect('new admin can use the console', await call('GET', '/admin/dashboard?days=7', NT), 200);
expect('new admin can manage the team', (await call('GET', '/admin/team', NT)).status === 200 ? { status: 200 } : { status: 0 }, 200);
expect('but not the super admin', await call('DELETE', `/admin/team/${saId}`, NT), 403);

expect('suspend', await call('PATCH', `/admin/team/${newId}`, SA, { status: 'suspended', suspendedReason: 'Test' }), 200);
expect('suspended admin locked out mid-session', await call('GET', '/admin/dashboard?days=7', NT), 403);
expect('suspended admin cannot sign in', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp2 }), 403);
expect('reactivate', await call('PATCH', `/admin/team/${newId}`, SA, { status: 'active' }), 200);
expect('reactivated admin can sign in', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp2 }), 200);

expect('remove administrator', await call('DELETE', `/admin/team/${newId}`, SA), 200);
expect('removed admin cannot sign in', await call('POST', '/auth/admin/login', null, { identifier: 'test.admin@agrimart.gh', password: temp2 }), 401);
expect('removed admin old session rejected', await call('GET', '/admin/dashboard?days=7', NT), 401);
const readd = expect('add the same person back', await call('POST', '/admin/team', SA, { fullName: 'Test Administrator', email: 'test.admin@agrimart.gh', phone: '0244999001' }), 201);
expect('cleanup: remove test administrator', await call('DELETE', `/admin/team/${readd.data?.member?.id}`, SA), 200);

const audit = await call('GET', '/admin/audit-logs?action=team.&limit=30', SA);
console.log(`== audit trail: ${audit.data?.length} team.* entries ==`);
(audit.data ?? []).slice(0, 4).forEach((a) => console.log(`   ${a.action} - ${a.description}`));

const team = await call('GET', '/admin/team', SA);
console.log(`== final team: ${team.data.members.map((m) => `${m.fullName} (${m.role}, ${m.status})`).join('; ')} ==`);
cleanupTestRows({ names: ['Test Administrator', 'Test Administrator Two', 'Sneaky Super'], phones: ['0244999001', '0244999002', '0244999003'] });
console.log('\n  test rows removed');

t.done();
