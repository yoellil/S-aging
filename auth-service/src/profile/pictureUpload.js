import { supabaseAdmin } from '../config/supabase.js';
import { logActivity } from '../logging/activityLogger.js';
import { ERROR_CODES, success, failure } from '../utils/errorHandler.js';
import { validateProfilePicture } from './profileValidation.js';

// ── Upload profile picture ──────────────────────────────────────────────────

export async function uploadProfilePicture(userId, file, ipAddress = null, userAgent = null) {
  // Validate file
  const valErr = validateProfilePicture(file);
  if (valErr) return valErr;

  try {
    // Get current picture URL for cleanup
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return failure(ERROR_CODES.USER_NOT_FOUND, 'User not found.');

    // Delete old picture from storage if exists
    if (profile.profile_picture_url) {
      try {
        const oldPath = _extractStoragePath(profile.profile_picture_url);
        if (oldPath) {
          await supabaseAdmin.storage.from('profile-pictures').remove([oldPath]);
        }
      } catch {
        // Non-critical — old file stays as orphan, continue upload
        console.warn('[PictureUpload] Failed to delete old picture, continuing...');
      }
    }

    // Build storage path: {userId}/{timestamp}_{sanitized_filename}
    const ext = file.originalname?.split('.').pop() || 'jpg';
    const safeName = `${Date.now()}_profile.${ext}`;
    const storagePath = `${userId}/${safeName}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('profile-pictures')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadErr) {
      console.error('[PictureUpload] Storage upload failed:', uploadErr.message);
      return failure(ERROR_CODES.UPLOAD_FAILED, 'Failed to upload profile picture. Please try again.');
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('profile-pictures')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || null;

    if (!publicUrl) {
      return failure(ERROR_CODES.UPLOAD_FAILED, 'Upload succeeded but could not generate URL.');
    }

    // Update profiles table
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        profile_picture_url: publicUrl,
        updated_at: new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('[PictureUpload] Profile update failed:', updateErr.message);
      // Try to clean up uploaded file
      await supabaseAdmin.storage.from('profile-pictures').remove([storagePath]);
      return failure(ERROR_CODES.UPLOAD_FAILED, 'Failed to save profile picture URL.');
    }

    // Log activity
    await logActivity(userId, 'profile_picture_uploaded', {
      file_name: file.originalname || safeName,
      file_size: file.size,
      upload_time: new Date().toISOString(),
    }, ipAddress, userAgent);

    return success(
      { profile_picture_url: publicUrl },
      'Profile picture uploaded successfully.'
    );
  } catch (err) {
    console.error('[PictureUpload] Unexpected error:', err.message);
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to upload profile picture. Please try again.');
  }
}

// ── Delete profile picture ──────────────────────────────────────────────────

export async function deleteProfilePicture(userId, ipAddress = null, userAgent = null) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return failure(ERROR_CODES.USER_NOT_FOUND, 'User not found.');

    if (!profile.profile_picture_url) {
      return failure(ERROR_CODES.NO_PICTURE_FOUND, 'No profile picture to delete.');
    }

    // Delete from storage
    const storagePath = _extractStoragePath(profile.profile_picture_url);
    if (storagePath) {
      const { error: delErr } = await supabaseAdmin.storage
        .from('profile-pictures')
        .remove([storagePath]);

      if (delErr) {
        console.error('[PictureUpload] Storage deletion failed:', delErr.message);
        // Continue to clear the URL anyway
      }
    }

    // Clear URL in profiles
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        profile_picture_url: null,
        updated_at: new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      return failure(ERROR_CODES.SERVER_ERROR, 'Failed to update profile.');
    }

    await logActivity(userId, 'profile_picture_deleted', {
      delete_time: new Date().toISOString(),
    }, ipAddress, userAgent);

    return success(null, 'Profile picture deleted successfully.');
  } catch {
    return failure(ERROR_CODES.SERVER_ERROR, 'Unable to delete profile picture. Please try again.');
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the storage path from a Supabase public URL.
 * URL format: https://{project}.supabase.co/storage/v1/object/public/profile-pictures/{userId}/{file}
 */
function _extractStoragePath(publicUrl) {
  if (!publicUrl) return null;
  const marker = '/storage/v1/object/public/profile-pictures/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
