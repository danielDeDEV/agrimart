const { User, Op } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Rules for administrator accounts, shared by the Admin team endpoints and the
 * general user endpoints so neither route can be used to get around the other.
 *
 * Administrators run the platform between them: any of them can add, edit,
 * suspend, reset and remove other administrators, and manage the people who
 * trade on the platform. What is protected is the owner's own account:
 *
 *  - A super administrator account can only be changed, suspended, demoted or
 *    removed by another super administrator.
 *  - Only a super administrator can appoint one, so an administrator cannot
 *    promote an ally and remove the owner through them.
 *  - Nobody can change their own role, suspend themselves or remove themselves.
 *  - A super administrator is never removed directly: demote to Admin first,
 *    and the last active super administrator can never be demoted or
 *    suspended, so the platform can't lock itself out.
 */

const STAFF_ROLES = ['admin', 'superadmin'];
const isStaffRole = (role) => STAFF_ROLES.includes(role);

const otherActiveSuperadmins = (excludeId) =>
  User.count({ where: { role: 'superadmin', status: 'active', id: { [Op.ne]: excludeId } } });

async function assertStaffChange(actor, target, patch = {}) {
  const touchesStaff = isStaffRole(target.role) || (patch.role && isStaffRole(patch.role));
  if (!touchesStaff) return;

  const isSuper = actor.role === 'superadmin';

  // The owner's account is off limits to ordinary administrators
  if (target.role === 'superadmin' && !isSuper) {
    throw ApiError.forbidden('Only a super administrator can change a super administrator account');
  }
  if (patch.role === 'superadmin' && !isSuper) {
    throw ApiError.forbidden('Only a super administrator can appoint another super administrator');
  }

  const isSelf = actor.id === target.id;
  if (isSelf && patch.role && patch.role !== target.role) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  if (isSelf && patch.status && patch.status !== 'active') {
    throw ApiError.badRequest('You cannot suspend your own account');
  }

  const losesSuperadmin =
    target.role === 'superadmin' &&
    target.status === 'active' &&
    ((patch.role && patch.role !== 'superadmin') || (patch.status && patch.status !== 'active'));

  if (losesSuperadmin && (await otherActiveSuperadmins(target.id)) === 0) {
    throw ApiError.badRequest('This is the only active super administrator. Make another admin a super administrator first.');
  }
}

async function assertStaffRemoval(actor, target) {
  if (actor.id === target.id) {
    throw ApiError.badRequest('You cannot remove your own account');
  }
  if (target.role === 'superadmin') {
    throw actor.role === 'superadmin'
      ? ApiError.forbidden('Super administrator accounts cannot be removed. Change the role to Admin first.')
      : ApiError.forbidden('Only a super administrator can remove a super administrator account');
  }
}

module.exports = { STAFF_ROLES, isStaffRole, assertStaffChange, assertStaffRemoval };
