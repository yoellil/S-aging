import { supabaseAdmin } from '../config/supabase.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';

export async function logout(token, ipAddress = null, userAgent = null) {
  if (!token)
    return failure(ERROR_CODES.INVALID_TOKEN, 'Session token is required.');

  const { data: session, error } = await supabaseAdmin
    .from('sessions')
    .select('id, user_id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !session)
    return failure(ERROR_CODES.INVALID_TOKEN, 'Session not found.');

  if (!session.is_active)
    return failure(ERROR_CODES.INVALID_TOKEN, 'Session is already inactive.');

  await supabaseAdmin
    .from('sessions')
    .update({ is_active: false })
    .eq('id', session.id);

  await logActivity(session.user_id, 'user_logout', {}, ipAddress, userAgent);

  return success(null, 'Logged out successfully.');
}
