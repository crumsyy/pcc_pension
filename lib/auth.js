import { NextResponse } from 'next/server';
import { getSessionDetails } from './session';

const ADMIN_ROLES = ['administrator', 'admin', 'super_admin', 'superadmin'];
const RECEPTIONIST_ROLES = ['receptionist'];

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function buildUnauthorizedResponse(reason, status = 401) {
  const messages = {
    no_session: 'No active session. Please log in.',
    invalid_token: 'Session expired or invalid. Please log in again.',
    concurrent_login: 'Session invalidated by a login from another device.',
    user_not_found: 'User account not found.',
    forbidden: 'Insufficient privileges for this action.',
  };
  return NextResponse.json(
    { error: messages[reason] || 'Unauthorized', reason },
    { status }
  );
}

export async function verifyAdmin() {
  const details = await getSessionDetails();

  if (!details.session) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse(details.reason || 'no_session'),
    };
  }

  const { session } = details;
  const role = normalizeRole(session.role);

  if (!ADMIN_ROLES.includes(role) && session.roleID !== 1) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse('forbidden', 403),
    };
  }

  return { authorized: true, session };
}

export async function verifyReceptionist() {
  const details = await getSessionDetails();

  if (!details.session) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse(details.reason || 'no_session'),
    };
  }

  const { session } = details;
  const role = normalizeRole(session.role);

  if (!RECEPTIONIST_ROLES.includes(role) && session.roleID !== 2) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse('forbidden', 403),
    };
  }

  return { authorized: true, session };
}

export async function verifyRole(allowedRoles = []) {
  const details = await getSessionDetails();

  if (!details.session) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse(details.reason || 'no_session'),
    };
  }

  const { session } = details;
  const role = normalizeRole(session.role);
  const allowed = allowedRoles.map(r => normalizeRole(r));

  if (!allowed.includes(role)) {
    return {
      authorized: false,
      response: buildUnauthorizedResponse('forbidden', 403),
    };
  }

  return { authorized: true, session };
}
