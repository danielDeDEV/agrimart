const crypto = require('crypto');
const { User, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { normalizePhone, isValidGhanaPhone } = require('../utils/helpers');
const auditService = require('../services/auditService');
const { STAFF_ROLES, isStaffRole, assertStaffChange, assertStaffRemoval } = require('../services/staffPolicy');

const MEMBER_FIELDS = [
  'id', 'uuid', 'fullName', 'email', 'phone', 'role', 'status', 'avatarUrl',
  'lastLoginAt', 'loginCount', 'suspendedReason', 'createdAt',
];

/** Never let a password hash leave the server, whichever scope loaded the row. */
const toMember = (user) => Object.fromEntries(MEMBER_FIELDS.map((key) => [key, user.get(key)]));

/** 14 characters from every class, skipping look-alikes (0/O, 1/l/I). */
function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const chars = sets.map((set) => set[crypto.randomInt(set.length)]);
  while (chars.length < 14) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const findMember = (id, scope) =>
  (scope ? User.scope(scope) : User).findOne({ where: { id, role: STAFF_ROLES } });

/** GET /admin/team — every admin may see who else has console access. */
exports.list = asyncHandler(async (req, res) => {
  const members = await User.findAll({
    where: { role: STAFF_ROLES },
    attributes: MEMBER_FIELDS,
    // ENUM order puts superadmin after admin, so DESC lists super administrators first
    order: [['role', 'DESC'], ['createdAt', 'ASC']],
  });

  return ok(res, {
    members,
    // Every administrator manages the team; only the owner touches owner accounts
    canManage: true,
    canManageSuperadmins: req.user.role === 'superadmin',
    currentUserId: req.user.id,
  });
});

/** POST /admin/team — super administrator adds an administrator. */
exports.create = asyncHandler(async (req, res) => {
  const { fullName, email, phone, role = 'admin', password } = req.body;

  if (!isStaffRole(role)) throw ApiError.badRequest('Choose Admin or Super administrator');
  // Appointing a super administrator stays with the super administrators
  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    throw ApiError.forbidden('Only a super administrator can appoint another super administrator');
  }
  const normalizedPhone = normalizePhone(phone);
  if (!isValidGhanaPhone(normalizedPhone)) throw ApiError.badRequest('Enter a valid Ghana phone number, e.g. 0244123456');
  const normalizedEmail = String(email).trim().toLowerCase();
  if (password && String(password).length < 8) throw ApiError.badRequest('The password must be at least 8 characters');

  const initialPassword = password || generatePassword();

  const existing = await User.scope('withSecrets').findOne({
    where: { [Op.or]: [{ email: normalizedEmail }, { phone: normalizedPhone }] },
    paranoid: false,
  });

  let member;
  if (existing && !existing.deletedAt) {
    throw ApiError.conflict(
      existing.email === normalizedEmail
        ? 'That email address already belongs to an account'
        : 'That phone number already belongs to an account'
    );
  } else if (existing && isStaffRole(existing.role)) {
    // A previously removed administrator is being added back: restore the record
    await existing.restore();
    existing.set({
      fullName, email: normalizedEmail, phone: normalizedPhone, role,
      status: 'active', suspendedReason: null, password: initialPassword,
    });
    await existing.save();
    member = existing;
  } else if (existing) {
    throw ApiError.conflict('That email or phone number belongs to a removed farmer or buyer account');
  } else {
    member = await User.create({
      fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role,
      status: 'active',
      password: initialPassword,
      registrationChannel: 'web',
      isPhoneVerified: true,
      isEmailVerified: true,
    });
  }

  await auditService.record(req, {
    action: 'team.create',
    entity: 'user',
    entityId: member.id,
    description: `Added ${member.fullName} as ${role === 'superadmin' ? 'super administrator' : 'administrator'}`,
    newValue: { email: member.email, role },
    severity: 'critical',
  });

  return created(
    res,
    { member: toMember(member), temporaryPassword: password ? undefined : initialPassword },
    `${member.fullName} can now sign in to the admin console`
  );
});

/** PATCH /admin/team/:id — details, role, or suspension. */
exports.update = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  if (!member) throw ApiError.notFound('Administrator not found');

  const patch = {};
  ['fullName', 'email', 'phone', 'role', 'status', 'suspendedReason'].forEach((key) => {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  });

  if (patch.role && !isStaffRole(patch.role)) throw ApiError.badRequest('Role must be Admin or Super administrator');
  if (patch.status && !['active', 'suspended'].includes(patch.status)) throw ApiError.badRequest('Status must be active or suspended');
  if (patch.fullName !== undefined && String(patch.fullName).trim().length < 3) throw ApiError.badRequest('Enter a full name');
  if (patch.email !== undefined) patch.email = String(patch.email).trim().toLowerCase();
  if (patch.phone !== undefined) {
    patch.phone = normalizePhone(patch.phone);
    if (!isValidGhanaPhone(patch.phone)) throw ApiError.badRequest('Enter a valid Ghana phone number');
  }
  if (patch.status === 'suspended') patch.suspendedReason = patch.suspendedReason || 'Suspended by an administrator';
  if (patch.status === 'active') patch.suspendedReason = null;

  await assertStaffChange(req.user, member, patch);

  const before = member.toJSON();
  await member.update(patch);

  const { oldValue, newValue, changed } = auditService.diff(before, member.toJSON(), Object.keys(patch));
  if (changed) {
    const action = patch.status ? `team.${patch.status === 'active' ? 'reactivate' : 'suspend'}` : patch.role ? 'team.role' : 'team.update';
    await auditService.record(req, {
      action,
      entity: 'user',
      entityId: member.id,
      description: `Updated administrator ${member.fullName}`,
      oldValue,
      newValue,
      severity: patch.status || patch.role ? 'critical' : 'warning',
    });
  }

  return ok(res, toMember(member), `${member.fullName} updated`);
});

/** POST /admin/team/:id/reset-password — issue a new password for another administrator. */
exports.resetPassword = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id, 'withSecrets');
  if (!member) throw ApiError.notFound('Administrator not found');
  if (member.id === req.user.id) throw ApiError.badRequest('Use "Change my password" for your own account');
  // A new password is a way into the account, so the owner's is protected like any other change
  if (member.role === 'superadmin' && req.user.role !== 'superadmin') {
    throw ApiError.forbidden('Only a super administrator can reset a super administrator password');
  }

  const { password } = req.body;
  if (password && String(password).length < 8) throw ApiError.badRequest('The password must be at least 8 characters');

  const newPassword = password || generatePassword();
  member.password = newPassword;
  await member.save();

  await auditService.record(req, {
    action: 'team.reset_password',
    entity: 'user',
    entityId: member.id,
    description: `Reset the password for ${member.fullName}`,
    severity: 'critical',
  });

  return ok(res, { temporaryPassword: password ? undefined : newPassword }, `Password reset for ${member.fullName}`);
});

/** DELETE /admin/team/:id — remove an administrator. */
exports.remove = asyncHandler(async (req, res) => {
  const member = await findMember(req.params.id);
  if (!member) throw ApiError.notFound('Administrator not found');

  await assertStaffRemoval(req.user, member);
  await member.destroy();

  await auditService.record(req, {
    action: 'team.remove',
    entity: 'user',
    entityId: member.id,
    description: `Removed administrator ${member.fullName} (${member.email})`,
    severity: 'critical',
  });

  return ok(res, null, `${member.fullName} no longer has admin access`);
});
