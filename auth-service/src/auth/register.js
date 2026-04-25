import { supabase, supabaseAdmin } from '../config/supabase.js';
import { validateEmail, validatePassword, validateUsername } from './validation.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';

export async function register({ email, username, password }, ipAddress = null, userAgent = null) {
  // Validate inputs
  const emailErr    = validateEmail(email);    if (emailErr)    return emailErr;
  const passErr     = validatePassword(password); if (passErr)  return passErr;
  const usernameErr = validateUsername(username); if (usernameErr) return usernameErr;

  // Check for duplicate email/username in profiles
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('email, username')
    .or(`email.eq.${email},username.eq.${username}`)
    .maybeSingle();

  if (existing?.email === email)
    return failure(ERROR_CODES.EMAIL_EXISTS, 'An account with this email already exists.');
  if (existing?.username === username)
    return failure(ERROR_CODES.USERNAME_EXISTS, 'This username is already taken.');

  // Create user in Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    if (authErr.message?.toLowerCase().includes('already registered'))
      return failure(ERROR_CODES.EMAIL_EXISTS, 'An account with this email already exists.');
    return failure(ERROR_CODES.SERVER_ERROR, authErr.message);
  }

  const userId = authData.user.id;

  // Insert profile record
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert({ id: userId, username, email });

  if (profileErr)
    return failure(ERROR_CODES.SERVER_ERROR, 'Account created but profile setup failed.');

  await logActivity(userId, 'user_registered', { username, email: '[redacted]' }, ipAddress, userAgent);

  return success(
    { userId, username, email },
    'Account created successfully. Please check your email to confirm your account.'
  );
}
