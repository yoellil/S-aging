import { supabase, supabaseAdmin } from '../config/supabase.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';
import {
  validateNewUsername,
  validateNewPassword,
  validateFullName,
  validatePhone,
  validateBio,
} from './profileValidation.js';

// ── Get user profile ────────────────────────────────────────────────────────

export async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, full_name, bio, phone, profile_picture_url, created_at, updated_at, profile_updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return failure(ERROR_CODES.USER_NOT_FOUND, 'User profile not found.');

    return success(profile, 'Profile retrieved successfully.');
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to retrieve profile. Please try again.');
  }
}

// ── Update username ─────────────────────────────────────────────────────────

export async function updateUsername(userId, newUsername, ipAddress = null, userAgent = null) {
  // Validate format
  const valErr = validateNewUsername(newUsername);
  if (valErr) return valErr;

  const trimmed = newUsername.trim();

  try {
    // Get current profile
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!profile) return failure(ERROR_CODES.USER_NOT_FOUND, 'User not found.');

    // Same as current?
    if (profile.username.toLowerCase() === trimmed.toLowerCase()) {
      return failure(ERROR_CODES.VALIDATION_FAILED, 'New username is the same as your current username.');
    }

    // Uniqueness check
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', trimmed)
      .neq('id', userId)
      .maybeSingle();

    if (existing) {
      return failure(ERROR_CODES.USERNAME_TAKEN, 'This username is already taken.');
    }

    // Update
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ username: trimmed, updated_at: new Date().toISOString(), profile_updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    // Log
    await logActivity(userId, 'username_changed', {
      old_username: profile.username,
      new_username: trimmed,
      requested_at: new Date().toISOString(),
    }, ipAddress, userAgent);

    return success({ username: trimmed }, 'Username updated successfully.');
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to update username. Please try again.');
  }
}

// ── Update password ─────────────────────────────────────────────────────────

export async function updatePassword(userId, currentPassword, newPassword, currentSessionToken = null, ipAddress = null, userAgent = null) {
  if (!currentPassword) {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'Current password is required.');
  }
  if (!newPassword) {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'New password is required.');
  }

  try {
    // Get user email for re-auth
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, username')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return failure(ERROR_CODES.USER_NOT_FOUND, 'User not found.');

    // Verify current password via Supabase Auth (sign in attempt)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (authErr) {
      await logActivity(userId, 'password_change_failed', {
        reason: 'invalid_current_password',
        attempt_time: new Date().toISOString(),
      }, ipAddress, userAgent);
      return failure(ERROR_CODES.INVALID_CURRENT_PASSWORD, 'Current password is incorrect.');
    }

    // Check new ≠ current
    if (currentPassword === newPassword) {
      await logActivity(userId, 'password_change_failed', {
        reason: 'password_same_as_current',
        attempt_time: new Date().toISOString(),
      }, ipAddress, userAgent);
      return failure(ERROR_CODES.PASSWORD_SAME, 'New password must be different from your current password.');
    }

    // Validate new password strength
    const valErr = validateNewPassword(newPassword, profile.username);
    if (valErr) {
      await logActivity(userId, 'password_change_failed', {
        reason: 'weak_password',
        attempt_time: new Date().toISOString(),
      }, ipAddress, userAgent);
      return valErr;
    }

    // Update via Supabase Admin API (requires service role key)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateErr) {
      console.error('[Profile] Password update via Admin API failed:', updateErr.message);
      return failure(ERROR_CODES.SERVER_ERROR, 'Unable to update password. Please try again.');
    }

    // Invalidate all other sessions
    const { error: sessErr } = await supabaseAdmin
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('token', currentSessionToken ?? '');

    if (sessErr) {
      console.error('[Profile] Failed to invalidate other sessions:', sessErr.message);
    }

    // Update profile timestamp
    await supabaseAdmin
      .from('profiles')
      .update({ updated_at: new Date().toISOString(), profile_updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Log
    await logActivity(userId, 'password_changed', {
      other_sessions_invalidated: !sessErr,
      change_time: new Date().toISOString(),
    }, ipAddress, userAgent);

    return success(null, 'Password updated successfully. You\'ve been logged out of other sessions.');
  } catch (err) {
    console.error('[Profile] updatePassword error:', err.message);
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to update password. Please try again.');
  }
}

// ── Update profile information ──────────────────────────────────────────────

export async function updateProfile(userId, updates, ipAddress = null, userAgent = null) {
  const { full_name, bio, phone } = updates || {};

  // Validate each provided field
  const nameErr = validateFullName(full_name);
  if (nameErr) return nameErr;

  const phoneErr = validatePhone(phone);
  if (phoneErr) return phoneErr;

  const bioErr = validateBio(bio);
  if (bioErr) return bioErr;

  try {
    // Get current values for diff logging
    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('full_name, bio, phone')
      .eq('id', userId)
      .maybeSingle();

    if (!current) return failure(ERROR_CODES.USER_NOT_FOUND, 'User not found.');

    // Build update object (only provided fields)
    const patch = { updated_at: new Date().toISOString(), profile_updated_at: new Date().toISOString() };
    const fieldsChanged = [];
    const oldValues = {};
    const newValues = {};

    if (full_name !== undefined) {
      const val = typeof full_name === 'string' ? full_name.trim() : null;
      if (val !== current.full_name) {
        patch.full_name = val || null;
        fieldsChanged.push('full_name');
        oldValues.full_name = current.full_name;
        newValues.full_name = val || null;
      }
    }
    if (bio !== undefined) {
      const val = typeof bio === 'string' ? bio.trim() : null;
      if (val !== current.bio) {
        patch.bio = val || null;
        fieldsChanged.push('bio');
        oldValues.bio = current.bio;
        newValues.bio = val || null;
      }
    }
    if (phone !== undefined) {
      const val = typeof phone === 'string' ? phone.trim() : null;
      if (val !== current.phone) {
        patch.phone = val || null;
        fieldsChanged.push('phone');
        oldValues.phone = current.phone;
        newValues.phone = val || null;
      }
    }

    if (fieldsChanged.length === 0) {
      return success(current, 'No changes detected.');
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('id, username, email, full_name, bio, phone, profile_picture_url, created_at, updated_at, profile_updated_at')
      .maybeSingle();

    if (error) throw error;

    await logActivity(userId, 'profile_updated', {
      fields_changed: fieldsChanged,
      old_values: oldValues,
      new_values: newValues,
      update_time: new Date().toISOString(),
    }, ipAddress, userAgent);

    return success(updated, 'Profile updated successfully.');
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to update profile. Please try again.');
  }
}
