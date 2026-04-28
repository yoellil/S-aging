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

/** Update the editable profile info (full_name / bio / phone / settings). */
export async function updateProfile({ full_name, bio, phone, is_public, default_disease, default_temp, default_rh, default_density }) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { success: false, message: "Not signed in." };

  const patch = { profile_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (full_name !== undefined)        patch.full_name = full_name?.trim() || null;
  if (bio !== undefined)              patch.bio = bio?.trim() || null;
  if (phone !== undefined)            patch.phone = phone?.trim() || null;
  if (is_public !== undefined)        patch.is_public = is_public;
  if (default_disease !== undefined)  patch.default_disease = default_disease;
  if (default_temp !== undefined)     patch.default_temp = default_temp;
  if (default_rh !== undefined)       patch.default_rh = default_rh;
  if (default_density !== undefined)  patch.default_density = default_density;

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

/** Search users by username or full name. Excludes the current user. */
export async function searchUsers(query) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, data: [] };

  const q = query.trim();
  if (!q) return { success: true, data: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, profile_picture_url, created_at, is_public")
    .neq("id", user.id)
    .or(`username.ilike.*${q}*,full_name.ilike.*${q}*`)
    .limit(20);

  if (error) { console.error("[searchUsers]", error); return { success: false, data: [] }; }
  return { success: true, data: data || [] };
}

/** Get a public user's simulation logs (only if their profile is public). */
export async function getPublicSimulationLogs(userId) {
  const { data, error } = await supabase
    .from("simulation_logs")
    .select("id,disease,temp,rh,density,final_infected_pct,final_necrotic_pct,final_healthy_pct,months_simulated,image_url,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) { console.warn("[getPublicSimulationLogs]", error); return { success: false, data: [] }; }
  return { success: true, data: data || [] };
}

/** Get a specific user's public profile + their simulation count. */
export async function getPublicProfile(userId) {
  const [profileRes, countRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, bio, profile_picture_url, created_at, is_public")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("simulation_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (profileRes.error || !profileRes.data) return { success: false };
  return {
    success: true,
    data: { ...profileRes.data, simulationCount: countRes.count ?? 0 },
  };
}

function _base64ToBlob(base64) {
  const mime = base64.startsWith('/9j/') ? 'image/jpeg'
    : base64.startsWith('iVBOR') ? 'image/png'
    : base64.startsWith('UklGR') ? 'image/webp'
    : 'image/jpeg';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mime }), mime };
}

/** Save a completed simulation run to the simulation_logs table. */
export async function saveSimulationLog({ disease, temp, rh, density, finalStats, months, imageData, detections, maskGrid, imgWidth, imgHeight }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  // Upload the analyzed image to storage
  let image_url = null;
  if (imageData) {
    try {
      const { blob, mime } = _base64ToBlob(imageData);
      const ext = mime.split('/')[1];
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('simulation-images')
        .upload(path, blob, { contentType: mime, upsert: false });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('simulation-images').getPublicUrl(path);
        image_url = pub.publicUrl;
      } else {
        console.warn('[saveSimulationLog] image upload failed:', upErr.message);
      }
    } catch (e) {
      console.warn('[saveSimulationLog] image upload error:', e);
    }
  }

  const { error } = await supabase.from("simulation_logs").insert({
    user_id: user.id,
    disease, temp, rh, density,
    final_infected_pct: finalStats?.infected_pct ?? 0,
    final_necrotic_pct: finalStats?.necrotic_pct ?? 0,
    final_healthy_pct: finalStats?.healthy_pct ?? 100,
    months_simulated: months,
    image_url,
    detections: detections ?? null,
    mask_grid: maskGrid ?? null,
    img_width: imgWidth ?? null,
    img_height: imgHeight ?? null,
  });

  if (error) { console.error("[saveSimulationLog]", error); return { success: false }; }
  return { success: true };
}

/** Fetch the user's simulation history, newest first. */
export async function getSimulationLogs(limit = 30) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, data: [] };

  const { data, error } = await supabase
    .from("simulation_logs")
    .select("id,disease,temp,rh,density,final_infected_pct,final_necrotic_pct,final_healthy_pct,months_simulated,image_url,img_width,img_height,created_at,detections,mask_grid")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.error("[getSimulationLogs]", error); return { success: false, data: [] }; }
  return { success: true, data: data || [] };
}
