import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, KeyRound, UserPen, Camera, Trash2, Save,
  LogIn, LogOut, Fingerprint, Mail, CalendarDays, Activity,
  RefreshCw,
} from "lucide-react";
import {
  getProfile, updateProfile, updateUsername, updatePassword,
  uploadProfilePicture, deleteProfilePicture, getSimulationLogs,
} from "./profileApi";

// ── Color tokens ────────────────────────────────────────────────────────────
const C = {
  green50: "#EAF3DE", green100: "#C0DD97", green200: "#97C459",
  green400: "#639922", green600: "#3B6D11", green800: "#27500A",
  teal50: "#E1F5EE", teal200: "#5DCAA5", teal600: "#0F6E56",
  amber50: "#FAEEDA", amber400: "#BA7517",
  red400: "#E24B4A", red50: "#FCEBEB",
  gray50: "#F8F7F4", gray100: "#EEEDEA", gray200: "#D3D1C7",
  gray400: "#888780", gray600: "#5F5E5A", gray800: "#2A2A28",
};

// ── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  const bg = type === "error" ? C.red50 : C.green50;
  const fg = type === "error" ? C.red400 : C.green600;
  const border = type === "error" ? "#F7C1C1" : C.green100;
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      style={{
        position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
        background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 24px",
        fontSize: 13, fontWeight: 500, color: fg, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        maxWidth: 420, textAlign: "center", backdropFilter: "blur(8px)",
      }}
    >
      {msg}
    </motion.div>
  );
}

// ── Animated section ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Input field ─────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, disabled, multiline, id }) {
  const shared = {
    id,
    value: value ?? "",
    onChange: e => onChange(e.target.value),
    placeholder, disabled,
    className: "profile-input",
  };
  return (
    <div className="profile-field">
      <label className="profile-label" htmlFor={id}>
        {Icon && <Icon size={12} style={{ marginRight: 5, opacity: 0.6 }} />}
        {label}
      </label>
      {multiline
        ? <textarea {...shared} rows={3} />
        : <input type={type} {...shared} />
      }
    </div>
  );
}

// ── Quick stat card ─────────────────────────────────────────────────────────
function QuickStat({ icon: Icon, label, value, color, delay }) {
  return (
    <FadeIn delay={delay}>
      <div className="profile-stat-card">
        <div className="profile-stat-icon" style={{ background: color + "18", color }}>
          <Icon size={16} />
        </div>
        <div className="profile-stat-value">{value}</div>
        <div className="profile-stat-label">{label}</div>
      </div>
    </FadeIn>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PROFILE PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ProfilePage({ auth, onLogout, onNavigate, setSimConfig }) {
  // No tokens. Supabase client handles auth automatically via session in localStorage.
  const userId = auth?.session?.user?.id || null;

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [toast, setToast] = useState(null);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(null);

  // Activity logs + stats (no longer used — kept harmless for UI)
  const [loginCount] = useState(0);

  // Simulation history
  const [simLogs, setSimLogs] = useState([]);
  const [simLogsLoading, setSimLogsLoading] = useState(true);
  const [rerunningId, setRerunningId] = useState(null);

  const fileRef = useRef(null);

  // ── Fetch profile ───────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!userId) { setProfileLoading(false); return; }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await getProfile();
      if (res.success) {
        const p = res.data;
        setProfile(p);
        setFullName(p.full_name ?? "");
        setBio(p.bio ?? "");
        setPhone(p.phone ?? "");
        setNewUsername(p.username ?? "");
      } else {
        setProfileError(res.message || "Could not load profile.");
      }
    } catch (e) {
      setProfileError(e.message || "Could not load profile.");
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (!userId) return;
    getSimulationLogs(30).then(res => {
      setSimLogs(res.data || []);
      setSimLogsLoading(false);
    });
  }, [userId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const flash = (msg, type = "success") => setToast({ msg, type, key: Date.now() });

  const handleSaveInfo = async () => {
    setSaving("info");
    const res = await updateProfile({ full_name: fullName, bio, phone });
    setSaving(null);
    if (res.success) { setProfile(p => ({ ...p, ...res.data })); flash(res.message); }
    else flash(res.message, "error");
  };

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return flash("Username cannot be empty.", "error");
    setSaving("username");
    const res = await updateUsername(newUsername.trim());
    setSaving(null);
    if (res.success) { setProfile(p => ({ ...p, username: res.data.username })); flash(res.message); }
    else flash(res.message, "error");
  };

  const handleChangePassword = async () => {
    if (!curPassword || !newPassword) return flash("Both fields are required.", "error");
    setSaving("password");
    const res = await updatePassword(curPassword, newPassword);
    setSaving(null);
    if (res.success) { setCurPassword(""); setNewPassword(""); flash(res.message); }
    else flash(res.message, "error");
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving("picture");
    const res = await uploadProfilePicture(file);
    setSaving(null);
    if (res.success) { setProfile(p => ({ ...p, profile_picture_url: res.data.profile_picture_url })); flash(res.message); }
    else flash(res.message, "error");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePictureDelete = async () => {
    setSaving("picture");
    const res = await deleteProfilePicture();
    setSaving(null);
    if (res.success) { setProfile(p => ({ ...p, profile_picture_url: null })); flash(res.message); }
    else flash(res.message, "error");
  };

  // ── State: loading auth ───────────────────────────────────────────────────
  if (auth?.status === "loading") {
    return (
      <div className="page-wrapper">
        <div className="profile-page">
          <div className="profile-empty-state">
            <div className="profile-loading-spinner" />
            <h3 style={{ marginTop: 16 }}>Connecting…</h3>
            <p>Establishing your session.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Profile-fetch states (auth is ready, but the API call is in flight or failed) ──
  if (profileLoading) {
    return (
      <div className="page-wrapper">
        <div className="profile-page">
          <div className="profile-empty-state">
            <div className="profile-loading-spinner" />
            <p style={{ marginTop: 16 }}>Loading profile…</p>
          </div>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="page-wrapper">
        <div className="profile-page">
          <div className="profile-empty-state">
            <Shield size={40} style={{ color: C.red400, marginBottom: 16 }} />
            <h3>Unable to load profile</h3>
            <p>{profileError || "The profile could not be loaded."}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="profile-btn profile-btn-primary" onClick={fetchProfile}>
                <RefreshCw size={13} /> Try again
              </button>
              <button className="profile-btn profile-btn-ghost" onClick={onLogout}>
                <LogOut size={13} /> Log out
              </button>
            </div>
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

  const memberDays = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    : 0;

  return (
    <div className="page-wrapper">
      <div className="profile-page">
        <AnimatePresence>
          {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        </AnimatePresence>

        {/* ═══════ HEADER CARD ═══════ */}
        <FadeIn>
          <div className="profile-header-card">
            <div className="profile-header-bg" />
            <div className="profile-header-content">
              <div className="profile-avatar-wrap" onClick={() => fileRef.current?.click()}>
                {profile.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Profile" className="profile-avatar-img" />
                ) : (
                  <div className="profile-avatar-placeholder">{initials}</div>
                )}
                <div className="profile-avatar-overlay">
                  <Camera size={18} />
                </div>
                <input
                  ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }} onChange={handlePictureUpload}
                />
                {saving === "picture" && <div className="profile-avatar-spinner" />}
              </div>
              {profile.profile_picture_url && (
                <button className="profile-avatar-remove" onClick={handlePictureDelete} title="Remove">
                  <Trash2 size={11} />
                </button>
              )}
              <div className="profile-header-info">
                <div className="profile-header-name">{profile.full_name || profile.username}</div>
                <div className="profile-header-username">@{profile.username}</div>
                <div className="profile-header-meta">
                  <span><Mail size={11} /> {profile.email}</span>
                  <span><CalendarDays size={11} /> Joined {memberSince}</span>
                </div>
                {profile.bio && <div className="profile-header-bio">{profile.bio}</div>}
              </div>
              <button className="profile-header-logout" onClick={onLogout} title="Log out">
                <LogOut size={13} /> Log out
              </button>
            </div>
          </div>
        </FadeIn>

        {/* ═══════ QUICK STATS ═══════ */}
        <div className="profile-stats-row">
          <QuickStat icon={CalendarDays} label="Days active" value={memberDays} color={C.green400} delay={0.05} />
          <QuickStat icon={LogIn} label="Total logins" value={loginCount} color={C.teal600} delay={0.1} />
          <QuickStat icon={Activity} label="Simulations" value={simLogs.length} color={C.amber400} delay={0.15} />
          <QuickStat icon={Shield} label="Security level" value="Good" color={C.green600} delay={0.2} />
        </div>

        {/* ═══════ TWO-COLUMN GRID ═══════ */}
        <div className="profile-grid">

          {/* ── LEFT COLUMN ── */}
          <div className="profile-col">
            {/* Personal info */}
            <FadeIn delay={0.1}>
              <div className="profile-card">
                <div className="profile-card-header">
                  <UserPen size={15} />
                  <span>Personal information</span>
                </div>
                <Field id="pf-fullname" icon={UserPen} label="Full name" value={fullName} onChange={setFullName} placeholder="Your full name" />
                <Field id="pf-bio" label="Bio" value={bio} onChange={setBio} placeholder="Tell us about yourself…" multiline />
                <Field id="pf-phone" label="Phone" value={phone} onChange={setPhone} placeholder="+63 912 345 6789" />
                <button className="profile-btn profile-btn-primary" onClick={handleSaveInfo} disabled={saving === "info"}>
                  <Save size={13} />
                  {saving === "info" ? "Saving…" : "Save changes"}
                </button>
              </div>
            </FadeIn>

            {/* Change username */}
            <FadeIn delay={0.15}>
              <div className="profile-card">
                <div className="profile-card-header">
                  <Fingerprint size={15} />
                  <span>Change username</span>
                </div>
                <Field id="pf-username" label="New username" value={newUsername} onChange={setNewUsername} placeholder="letters, numbers, underscores" />
                <div className="profile-hint">3–50 characters · Alphanumeric and underscores only</div>
                <button className="profile-btn profile-btn-primary" onClick={handleChangeUsername} disabled={saving === "username"}>
                  {saving === "username" ? "Updating…" : "Update username"}
                </button>
              </div>
            </FadeIn>

            {/* Change password */}
            <FadeIn delay={0.2}>
              <div className="profile-card">
                <div className="profile-card-header">
                  <KeyRound size={15} />
                  <span>Change password</span>
                </div>
                <Field id="pf-curpw" label="Current password" type="password" value={curPassword} onChange={setCurPassword} placeholder="Enter current password" />
                <Field id="pf-newpw" label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min 8 chars, uppercase, number, symbol" />
                <div className="profile-hint">Other sessions will be logged out automatically</div>
                <button className="profile-btn profile-btn-primary" onClick={handleChangePassword} disabled={saving === "password"}>
                  <KeyRound size={13} />
                  {saving === "password" ? "Changing…" : "Change password"}
                </button>
              </div>
            </FadeIn>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="profile-col">
            {/* Account details */}
            <FadeIn delay={0.1}>
              <div className="profile-card">
                <div className="profile-card-header">
                  <Shield size={15} />
                  <span>Account details</span>
                </div>
                <div className="profile-detail-list">
                  {[
                    { label: "User ID", value: profile.id?.slice(0, 8) + "…", mono: true },
                    { label: "Email", value: profile.email },
                    { label: "Username", value: "@" + profile.username },
                    { label: "Member since", value: memberSince },
                    { label: "Last updated", value: profile.profile_updated_at ? _relativeTime(profile.profile_updated_at) : "Never" },
                    { label: "Last login", value: "—" },
                  ].map(({ label, value, mono }) => (
                    <div className="profile-detail-row" key={label}>
                      <span className="profile-detail-label">{label}</span>
                      <span className={`profile-detail-value${mono ? " mono" : ""}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Simulation history */}
            <FadeIn delay={0.2}>
              <div className="profile-card">
                <div className="profile-card-header">
                  <Activity size={15} />
                  <span>Simulation history</span>
                  {simLogs.length > 0 && <span className="profile-card-badge">{simLogs.length}</span>}
                </div>
                {simLogsLoading ? (
                  <div className="profile-hint" style={{ padding: "20px 0", textAlign: "center" }}>Loading…</div>
                ) : simLogs.length === 0 ? (
                  <div className="profile-hint" style={{ padding: "20px 0", textAlign: "center" }}>No simulations run yet</div>
                ) : (
                  <div className="profile-simlog-list">
                    {simLogs.map((log, i) => {
                      const isFW = log.disease === "fusarium_wilt";
                      const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
                      const diseaseColor = isFW ? C.amber400 : C.teal600;
                      const diseaseBg = isFW ? C.amber50 : C.teal50;
                      const isRerunning = rerunningId === log.id;

                      const handleRerun = async () => {
                        if (rerunningId) return;
                        setRerunningId(log.id);
                        let imageData = null;
                        if (log.image_url) {
                          try {
                            const res = await fetch(log.image_url);
                            const blob = await res.blob();
                            imageData = await new Promise((resolve) => {
                              const reader = new FileReader();
                              reader.onloadend = () => resolve(reader.result?.split(",")[1] ?? null);
                              reader.readAsDataURL(blob);
                            });
                          } catch {
                            // proceed without image
                          }
                        }
                        setSimConfig?.({
                          disease: log.disease,
                          temp: Number(log.temp),
                          rh: Number(log.rh),
                          density: log.density,
                          detections: log.detections ?? null,
                          maskGrid: log.mask_grid ?? null,
                          imgWidth: log.img_width ?? null,
                          imgHeight: log.img_height ?? null,
                          imageData,
                        });
                        setRerunningId(null);
                        onNavigate?.("simulation");
                      };

                      return (
                        <motion.div
                          className={`profile-simlog-item${isRerunning ? " rerunning" : ""}`}
                          key={log.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.3 }}
                          onClick={handleRerun}
                          title="Click to re-run this simulation"
                        >
                          {log.image_url ? (
                            <img src={log.image_url} alt="" className="profile-simlog-thumb" />
                          ) : (
                            <div className="profile-simlog-badge" style={{ background: diseaseBg, color: diseaseColor }}>
                              {isFW ? "FW" : "BS"}
                            </div>
                          )}
                          <div className="profile-simlog-body">
                            <div className="profile-simlog-title">{diseaseName}</div>
                            <div className="profile-simlog-meta">
                              {log.temp}°C · {log.rh}% RH · {log.density} density · {log.months_simulated} mo
                            </div>
                            <div className="profile-simlog-stats">
                              <span style={{ color: C.green600 }}>✓ {Number(log.final_healthy_pct).toFixed(1)}% healthy</span>
                              <span style={{ color: C.amber400 }}>⚠ {Number(log.final_infected_pct).toFixed(1)}% infected</span>
                              <span style={{ color: C.red400 }}>✕ {Number(log.final_necrotic_pct).toFixed(1)}% necrotic</span>
                            </div>
                          </div>
                          <div className="profile-simlog-right">
                            <div className="profile-simlog-time">{_relativeTime(log.created_at)}</div>
                            <div className="profile-simlog-rerun">
                              {isRerunning ? "Loading…" : "Re-run →"}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Security tips */}
            <FadeIn delay={0.25}>
              <div className="profile-card profile-card-accent">
                <div className="profile-card-header">
                  <Shield size={15} />
                  <span>Security tips</span>
                </div>
                <ul className="profile-tips">
                  <li>Use a strong, unique password with mixed characters</li>
                  <li>Log out when using shared or public devices</li>
                  <li>Check your activity log regularly for suspicious logins</li>
                  <li>Keep your email address up to date for recovery</li>
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────


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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
