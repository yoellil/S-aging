// ════════════════════════════════════════════════════════════════
// profileApi.js — Direct Supabase access for profiles. No tokens.
// Auth is handled entirely by the Supabase client itself.
// ════════════════════════════════════════════════════════════════

import { supabase } from "./utils/supabase";

const PROFILE_COLS = "*";

/**
 * Load the current user's profile. Auto-creates a row if missing
 * (useful when a user existed before the auto-create trigger was added).
 */
export async function getProfile() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { success: false, message: "Not signed in." };

  // Try to fetch
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getProfile] Supabase error:", error);
    return { success: false, message: error.message };
  }

  if (data) return { success: true, data };

  // No row — create one
  const fallbackUsername = user.email ? user.email.split("@")[0] : `user_${user.id.slice(0, 8)}`;
  const { data: created, error: insertErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      username: fallbackUsername,
    })
    .select(PROFILE_COLS)
    .single();

  if (insertErr) {
    console.error("[getProfile] Insert failed:", insertErr);
    return { success: false, message: insertErr.message };
  }
  return { success: true, data: created };
}

/** Update the editable profile info (full_name / bio / phone). */
export async function updateProfile({ full_name, bio, phone }) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { success: false, message: "Not signed in." };

  const patch = { profile_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (full_name !== undefined)   patch.full_name = full_name?.trim() || null;
  if (bio !== undefined)         patch.bio = bio?.trim() || null;
  if (phone !== undefined)       patch.phone = phone?.trim() || null;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(PROFILE_COLS)
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, data, message: "Profile updated." };
}

/** Update username with uniqueness check. */
export async function updateUsername(newUsername) {
  const trimmed = (newUsername || "").trim();
  if (!/^[A-Za-z0-9_]{3,50}$/.test(trimmed)) {
    return { success: false, message: "Username must be 3–50 chars, letters/numbers/underscore only." };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not signed in." };

  // Check uniqueness
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", trimmed)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) return { success: false, message: "Username is already taken." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ username: trimmed, profile_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select(PROFILE_COLS)
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, data, message: "Username updated." };
}

/** Change password using Supabase's built-in user update. */
export async function updatePassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return { success: false, message: "Both current and new password are required." };
  }
  if (newPassword.length < 8) {
    return { success: false, message: "New password must be at least 8 characters." };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, message: "Not signed in." };

  // Verify current password by re-authenticating
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: user.email, password: currentPassword,
  });
  if (authErr) return { success: false, message: "Current password is incorrect." };

  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updErr) return { success: false, message: updErr.message };

  return { success: true, message: "Password updated." };
}

/** Upload an avatar to Supabase Storage and update the profiles row. */
export async function uploadProfilePicture(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not signed in." };

  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { success: false, message: "Only JPEG, PNG, WebP, or GIF allowed." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, message: "File must be under 5 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  console.log("[uploadProfilePicture] Uploading to path:", path, "type:", file.type, "size:", file.size);

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from("profile-pictures")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) {
    console.error("[uploadProfilePicture] Storage upload failed:", uploadErr);
    return { success: false, message: `Upload failed: ${uploadErr.message}` };
  }

  console.log("[uploadProfilePicture] Upload succeeded:", uploadData);

  const { data: pub } = supabase.storage.from("profile-pictures").getPublicUrl(path);
  const url = pub.publicUrl;
  console.log("[uploadProfilePicture] Public URL:", url);

  // Best-effort: delete previous avatar
  const { data: prev } = await supabase
    .from("profiles").select("profile_picture_url").eq("id", user.id).maybeSingle();
  const prevUrl = prev?.profile_picture_url;
  if (prevUrl && prevUrl.includes("/profile-pictures/")) {
    const prevPath = prevUrl.split("/profile-pictures/")[1];
    if (prevPath && prevPath !== path) {
      await supabase.storage.from("profile-pictures").remove([prevPath]).catch(() => {});
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      profile_picture_url: url,
      profile_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_COLS)
    .single();

  if (error) {
    console.error("[uploadProfilePicture] Profile update failed:", error);
    return { success: false, message: `Saved image but couldn't update profile: ${error.message}` };
  }
  console.log("[uploadProfilePicture] Profile updated with url:", url);
  return { success: true, data: { ...data, profile_picture_url: url }, message: "Picture uploaded." };
}

export async function deleteProfilePicture() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not signed in." };

  const { data: prev } = await supabase
    .from("profiles").select("profile_picture_url").eq("id", user.id).maybeSingle();
  const prevUrl = prev?.profile_picture_url;
  if (prevUrl && prevUrl.includes("/profile-pictures/")) {
    const prevPath = prevUrl.split("/profile-pictures/")[1];
    if (prevPath) await supabase.storage.from("profile-pictures").remove([prevPath]).catch(() => {});
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      profile_picture_url: null,
      profile_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_COLS)
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, data, message: "Picture removed." };
}

/** Activity logs are unused now — return empty success so the UI keeps working. */
export async function getActivityLogs() {
  return { success: true, data: [], total: 0 };
}
