import { supabaseAdmin } from '../config/supabase.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Full logout flow:
 *  1. Validate token format
 *  2. Look up session in DB
 *  3. Guard: already inactive → already_logged_out
 *  4. Guard: expired → mark inactive, return session_expired
 *  5. Optionally verify user_id matches (when called from protected route)
 *  6. Deactivate session
 *  7. Log activity
 *  8. Return structured response
 *
 * @param {string}      token       Session token (UUID)
 * @param {string|null} ipAddress
 * @param {string|null} userAgent
 * @param {string|null} callerUserId  If provided, verify session belongs to this user
 */
export async function logout(token, ipAddress = null, userAgent = null, callerUserId = null) {
  // ── 1. Token format ──────────────────────────────────────────────────────
  if (!token || typeof token !== 'string') {
    return failure(ERROR_CODES.INVALID_TOKEN, 'Session token is required.');
  }

  if (!UUID_RE.test(token.trim())) {
    return failure(ERROR_CODES.INVALID_TOKEN, 'Invalid token format.');
  }

  // ── 2. Look up session ────────────────────────────────────────────────────
  let session;
  try {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, is_active, expires_at')
      .eq('token', token.trim())
      .maybeSingle();

    if (error) throw error;
    session = data;
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to process logout request. Please try again.');
  }

  if (!session) {
    return failure(ERROR_CODES.INVALID_TOKEN, 'Invalid or expired session.');
  }

  // ── 3. Already inactive ───────────────────────────────────────────────────
  if (!session.is_active) {
    return failure(ERROR_CODES.ALREADY_LOGGED_OUT, 'You are already logged out of this session.');
  }

  // ── 4. Expired ────────────────────────────────────────────────────────────
  if (new Date(session.expires_at) < new Date()) {
    // Mark inactive (clean-up) but tell user session was expired
    await supabaseAdmin.from('sessions').update({ is_active: false }).eq('id', session.id);
    await logActivity(session.user_id, 'session_expired', {
      session_token: session.id,
      expired_at: session.expires_at,
    }, ipAddress, userAgent);
    return failure(ERROR_CODES.SESSION_EXPIRED, 'Your session has expired. Please log in again.');
  }

  // ── 5. User ownership check ───────────────────────────────────────────────
  if (callerUserId && callerUserId !== session.user_id) {
    await logActivity(callerUserId, 'unauthorized_logout_attempt', {
      attempted_session: session.id,
    }, ipAddress, userAgent);
    return failure(ERROR_CODES.UNAUTHORIZED, 'You cannot log out another user\'s session.');
  }

  // ── 6. Deactivate ─────────────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('sessions').update({ is_active: false }).eq('id', session.id);
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Logout failed. Please try again.');
  }

  // ── 7. Log ────────────────────────────────────────────────────────────────
  const loggedOutAt = new Date().toISOString();
  await logActivity(session.user_id, 'user_logout', {
    session_token: session.id,
    logout_time: loggedOutAt,
    token_invalidated: true,
  }, ipAddress, userAgent);

  // ── 8. Response ───────────────────────────────────────────────────────────
  return success(
    { logged_out_at: loggedOutAt, session_invalidated: true },
    'You have been successfully logged out.'
  );
}
