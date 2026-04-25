import { supabase, supabaseAdmin } from '../config/supabase.js';
import { validateEmail } from './validation.js';
import { logActivity } from '../logging/activityLogger.js';
import { generateSessionToken, sessionExpiry } from '../utils/tokenGenerator.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';

export async function login({ email, password }, ipAddress = null, userAgent = null) {
  const emailErr = validateEmail(email);
  if (emailErr) return emailErr;

  if (!password)
    return failure(ERROR_CODES.INVALID_CREDENTIALS, 'Password is required.');

  // Authenticate via Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

  if (authErr || !authData?.user) {
    // Log failed attempt (best-effort lookup of user_id)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profile?.id) {
      await logActivity(profile.id, 'failed_login_attempt', { email: '[redacted]', reason: authErr?.message }, ipAddress, userAgent);
    }

    return failure(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password.');
  }

  const user = authData.user;

  // Fetch profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username, email')
    .eq('id', user.id)
    .maybeSingle();

  // Create session record
  const token = generateSessionToken();
  const expiresAt = sessionExpiry(24);

  const { error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .insert({ user_id: user.id, token, expires_at: expiresAt });

  if (sessionErr)
    return failure(ERROR_CODES.SERVER_ERROR, 'Login succeeded but session creation failed.');

  await logActivity(user.id, 'user_login', { username: profile?.username }, ipAddress, userAgent);

  return success(
    {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, username: profile?.username },
    },
    'Logged in successfully.'
  );
}
