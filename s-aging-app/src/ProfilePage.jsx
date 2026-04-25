import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  getProfile, updateProfile, updateUsername, updatePassword,
  uploadProfilePicture, deleteProfilePicture, getActivityLogs,
} from "./api";

// ── Color tokens (match App.jsx) ────────────────────────────────────────────
const C = {
  green50: "#EAF3DE", green100: "#C0DD97", green200: "#97C459",
  green400: "#639922", green600: "#3B6D11",
  teal50: "#E1F5EE", teal600: "#0F6E56",
  amber400: "#BA7517", amber50: "#FAEEDA",
  red400: "#E24B4A", red50: "#FCEBEB",
  gray50: "#F8F7F4", gray100: "#EEEDEA", gray200: "#D3D1C7",
  gray400: "#888780", gray600: "#5F5E5A", gray800: "#2A2A28",
};

// ── Tiny toast ──────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  const bg = type === "error" ? C.red50 : C.green50;
  const fg = type === "error" ? C.red400 : C.green600;
  const border = type === "error" ? "#F7C1C1" : C.green100;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{
        position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
        background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 20px",
        fontSize: 13, fontWeight: 500, color: fg, boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        maxWidth: 400, textAlign: "center",
      }}
    >
      {msg}
    </motion.div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, children, delay = 0 }) {
  return (
    <motion.div
      className="profile-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="profile-section-title">{title}</div>
      {children}
    </motion.div>
  );
}

// ── Inline field ────────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, disabled, multiline }) {
  const shared = {
    value: value ?? "",
    onChange: e => onChange(e.target.value),
    placeholder, disabled,
    className: "profile-input",
  };
  return (
    <div className="profile-field">
      <label className="profile-label">{label}</label>
      {multiline
        ? <textarea {...shared} rows={3} />
        : <input type={type} {...shared} />
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PROFILE PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ProfilePage({ session, sessionToken }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(null); // "info" | "username" | "password" | "picture"

  // Activity logs
  const [logs, setLogs] = useState([]);

  const fileRef = useRef(null);

  // ── Fetch profile on mount ────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const res = await getProfile(sessionToken);
    if (res.success) {
      const p = res.data;
      setProfile(p);
      setFullName(p.full_name ?? "");
      setBio(p.bio ?? "");
      setPhone(p.phone ?? "");
      setNewUsername(p.username ?? "");
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Fetch recent logs
  useEffect(() => {
    if (!sessionToken) return;
    getActivityLogs(sessionToken, 8).then(res => {
      if (res.success) setLogs(res.data ?? []);
    });
  }, [sessionToken]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const flash = (msg, type = "success") => setToast({ msg, type, key: Date.now() });

  const handleSaveInfo = async () => {
    setSaving("info");
    const res = await updateProfile(sessionToken, { full_name: fullName, bio, phone });
    setSaving(null);
    if (res.success) {
      setProfile(p => ({ ...p, ...res.data }));
      flash(res.message);
    } else {
      flash(res.message, "error");
    }
  };

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return flash("Username cannot be empty.", "error");
    setSaving("username");
    const res = await updateUsername(sessionToken, newUsername.trim());
    setSaving(null);
    if (res.success) {
      setProfile(p => ({ ...p, username: res.data.username }));
      flash(res.message);
    } else {
      flash(res.message, "error");
    }
  };

  const handleChangePassword = async () => {
    if (!curPassword || !newPassword) return flash("Both fields are required.", "error");
    setSaving("password");
    const res = await updatePassword(sessionToken, curPassword, newPassword);
    setSaving(null);
    if (res.success) {
      setCurPassword(""); setNewPassword("");
      flash(res.message);
    } else {
      flash(res.message, "error");
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!valid.includes(file.type)) return flash("Only JPEG, PNG, WebP, or GIF images.", "error");
    if (file.size > 5 * 1024 * 1024) return flash("File must be under 5 MB.", "error");
    setSaving("picture");
    const res = await uploadProfilePicture(sessionToken, file);
    setSaving(null);
    if (res.success) {
      setProfile(p => ({ ...p, profile_picture_url: res.data.profile_picture_url }));
      flash(res.message);
    } else {
      flash(res.message, "error");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePictureDelete = async () => {
    setSaving("picture");
    const res = await deleteProfilePicture(sessionToken);
    setSaving(null);
    if (res.success) {
      setProfile(p => ({ ...p, profile_picture_url: null }));
      flash(res.message);
    } else {
      flash(res.message, "error");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="profile-page">
          <div style={{ textAlign: "center", padding: 60, color: C.gray400, fontSize: 14 }}>
            Loading profile…
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-wrapper">
        <div className="profile-page">
          <div style={{ textAlign: "center", padding: 60, color: C.red400, fontSize: 14 }}>
            Unable to load profile. Is the auth service running?
          </div>
        </div>
      </div>
    );
  }

  const initials = (profile.full_name || profile.username || "U")
    .split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="page-wrapper">
      <div className="profile-page">
        <AnimatePresence>
          {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        </AnimatePresence>

        {/* ── Header card ── */}
        <motion.div
          className="profile-header-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="profile-avatar-wrap" onClick={() => fileRef.current?.click()}>
            {profile.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt="Profile" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-placeholder">{initials}</div>
            )}
            <div className="profile-avatar-overlay">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Change</span>
            </div>
            <input
              ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }} onChange={handlePictureUpload}
            />
          </div>
          {profile.profile_picture_url && (
            <button className="profile-avatar-delete" onClick={handlePictureDelete} title="Remove picture">
              ✕
            </button>
          )}
          <div className="profile-header-info">
            <div className="profile-header-name">{profile.full_name || profile.username}</div>
            <div className="profile-header-username">@{profile.username}</div>
            <div className="profile-header-email">{profile.email}</div>
            <div className="profile-header-since">Member since {memberSince}</div>
          </div>
          {saving === "picture" && (
            <div className="profile-saving-badge">Uploading…</div>
          )}
        </motion.div>

        {/* ── Profile information ── */}
        <Section title="Profile information" delay={0.06}>
          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Your full name" />
          <Field label="Bio" value={bio} onChange={setBio} placeholder="Tell us about yourself" multiline />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+63 912 345 6789" />
          <button
            className="profile-btn profile-btn-primary"
            onClick={handleSaveInfo}
            disabled={saving === "info"}
          >
            {saving === "info" ? "Saving…" : "Save changes"}
          </button>
        </Section>

        {/* ── Change username ── */}
        <Section title="Change username" delay={0.12}>
          <Field label="New username" value={newUsername} onChange={setNewUsername} placeholder="letters, numbers, underscores" />
          <div className="profile-hint">3–50 characters. Alphanumeric and underscores only.</div>
          <button
            className="profile-btn profile-btn-primary"
            onClick={handleChangeUsername}
            disabled={saving === "username"}
          >
            {saving === "username" ? "Updating…" : "Update username"}
          </button>
        </Section>

        {/* ── Change password ── */}
        <Section title="Change password" delay={0.18}>
          <Field label="Current password" type="password" value={curPassword} onChange={setCurPassword} placeholder="Enter current password" />
          <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min 8 chars, 1 upper, 1 number, 1 symbol" />
          <div className="profile-hint">Must include uppercase, lowercase, number, and special character.</div>
          <button
            className="profile-btn profile-btn-primary"
            onClick={handleChangePassword}
            disabled={saving === "password"}
          >
            {saving === "password" ? "Changing…" : "Change password"}
          </button>
        </Section>

        {/* ── Recent activity ── */}
        <Section title="Recent activity" delay={0.24}>
          {logs.length === 0 ? (
            <div className="profile-hint" style={{ padding: "12px 0" }}>No recent activity.</div>
          ) : (
            <div className="profile-activity-list">
              {logs.map((log, i) => (
                <div className="profile-activity-item" key={log.id || i}>
                  <div className="profile-activity-dot" />
                  <div className="profile-activity-body">
                    <span className="profile-activity-action">{_formatAction(log.action)}</span>
                    <span className="profile-activity-time">{_relativeTime(log.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _formatAction(action) {
  const map = {
    user_login: "Logged in",
    user_logout: "Logged out",
    user_registered: "Account created",
    username_changed: "Username changed",
    password_changed: "Password changed",
    password_change_failed: "Password change attempt",
    profile_updated: "Profile updated",
    profile_picture_uploaded: "Profile picture uploaded",
    profile_picture_deleted: "Profile picture removed",
    session_expired: "Session expired",
    failed_login_attempt: "Failed login attempt",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function _relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
