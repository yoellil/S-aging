import { supabaseAdmin } from '../config/supabase.js';

/**
 * Insert a log entry. Never throws — logging failures are silent to avoid
 * breaking the auth flow.
 */
export async function logActivity(userId, action, details = {}, ipAddress = null, userAgent = null) {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      user_id:    userId,
      action,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch {
    // Intentionally silent — logging must not break auth flows
  }
}

/**
 * Paginated log retrieval for a user.
 */
export async function getUserLogs(userId, limit = 20, offset = 0) {
  const { data, error, count } = await supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { success: false, error: error.message };
  return { success: true, data, total: count, limit, offset };
}

/**
 * Aggregate stats: login count, last login, total logged actions.
 */
export async function getActivityStats(userId) {
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select('action, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) return { success: false, error: error.message };

  const logins     = data.filter(l => l.action === 'user_login');
  const lastLogin  = logins[0]?.timestamp ?? null;
  const loginCount = logins.length;
  const totalLogs  = data.length;

  return { success: true, data: { loginCount, lastLogin, totalLogs } };
}

/**
 * Filtered log search by action and/or date range.
 */
export async function searchLogs(userId, action = null, dateRange = {}) {
  let query = supabaseAdmin
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (action)         query = query.eq('action', action);
  if (dateRange.from) query = query.gte('timestamp', dateRange.from);
  if (dateRange.to)   query = query.lte('timestamp', dateRange.to);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
