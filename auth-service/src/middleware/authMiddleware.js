import { supabaseAdmin } from '../config/supabase.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, failure } from '../utils/errorHandler.js';

/**
 * Validate a session token and attach user_id to the request.
 * Use as Express middleware: app.use('/protected', requireAuth, handler)
 */
export async function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json(failure(ERROR_CODES.INVALID_TOKEN, 'Session token required.'));
  }

  const { data: session, error } = await supabaseAdmin
    .from('sessions')
    .select('user_id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !session) {
    await _logSuspicious(null, 'invalid_token_attempt', token, req);
    return res.status(401).json(failure(ERROR_CODES.INVALID_TOKEN, 'Invalid session token.'));
  }

  if (!session.is_active) {
    return res.status(401).json(failure(ERROR_CODES.INVALID_TOKEN, 'Session is no longer active.'));
  }

  if (new Date(session.expires_at) < new Date()) {
    // Mark expired
    await supabaseAdmin.from('sessions').update({ is_active: false }).eq('token', token);
    await logActivity(session.user_id, 'session_expired', {}, _ip(req), req.headers['user-agent']);
    return res.status(401).json(failure(ERROR_CODES.SESSION_EXPIRED, 'Session has expired. Please log in again.'));
  }

  req.userId = session.user_id;
  req.sessionToken = token;
  next();
}

async function _logSuspicious(userId, action, token, req) {
  await logActivity(
    userId ?? '00000000-0000-0000-0000-000000000000',
    action,
    { token_prefix: token?.slice(0, 8) + '...' },
    _ip(req),
    req.headers['user-agent']
  );
}

function _ip(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null
  );
}
