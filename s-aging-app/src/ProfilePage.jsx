import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, KeyRound, UserPen, Camera, Trash2, Save,
  LogIn, LogOut, Fingerprint, Mail, CalendarDays, Activity,
  RefreshCw, Search, X, ArrowLeft, Users, Orbit,
  Settings, Sun, Moon, Globe, Lock, Download, Check,
} from "lucide-react";
import {
  getProfile, updateProfile, updateUsername, updatePassword,
  uploadProfilePicture, deleteProfilePicture, getSimulationLogs,
  searchUsers, getPublicProfile, getPublicSimulationLogs,
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
export default function ProfilePage({ auth, onLogout, onNavigate, setSimConfig, theme, setTheme }) {
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

  // Activity logs + stats
  const [loginCount] = useState(0);

  // Simulation history
  const [simLogs, setSimLogs] = useState([]);
  const [simLogsLoading, setSimLogsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // User search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // ── Debounced user search ──────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const res = await searchUsers(searchQuery);
      setSearchResults(res.data || []);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

        <AnimatePresence>
          {selectedLog && (
            <SimLogDetailModal
              log={selectedLog}
              onClose={() => setSelectedLog(null)}
              setSimConfig={setSimConfig}
              onNavigate={onNavigate}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {settingsOpen && (
            <SettingsModal
              profile={profile}
              theme={theme}
              setTheme={setTheme}
              simLogs={simLogs}
              setSimConfig={setSimConfig}
              onClose={() => setSettingsOpen(false)}
              onSaved={(updated) => {
                setProfile(p => ({ ...p, ...updated }));
                flash("Settings saved.");
              }}
            />
          )}
        </AnimatePresence>

        {/* ═══════ USER SEARCH BAR ═══════ */}
        <div className="profile-search-wrap">
          <div className="profile-search-box">
            <Search size={15} style={{ color: C.gray400, flexShrink: 0 }} />
            <input
              className="profile-search-input"
              placeholder="Search users by name or username…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setViewingUser(null); }}
            />
            {searchQuery && (
              <button className="profile-search-clear" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                <X size={14} />
              </button>
            )}
          </div>
          <AnimatePresence>
            {searchQuery && (
              <motion.div
                className="profile-search-results"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {searchLoading && (
                  <div className="profile-search-empty">Searching…</div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="profile-search-empty">No users found for "{searchQuery}"</div>
                )}
                {!searchLoading && searchResults.map(u => {
                  const uInitials = (u.full_name || u.username || "U")
                    .split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                  return (
                    <button
                      key={u.id}
                      className="profile-search-result"
                      onClick={() => { setViewingUser(u); setSearchQuery(""); setSearchResults([]); }}
                    >
                      {u.profile_picture_url
                        ? <img src={u.profile_picture_url} className="profile-search-avatar" alt="" />
                        : <div className="profile-search-avatar profile-search-avatar-initials">{uInitials}</div>
                      }
                      <div className="profile-search-info">
                        <span className="profile-search-name">{u.full_name || u.username}</span>
                        <span className="profile-search-username">@{u.username}</span>
                      </div>
                      {u.bio && <span className="profile-search-bio">{u.bio}</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════ PUBLIC PROFILE VIEW ═══════ */}
        <AnimatePresence mode="wait">
          {viewingUser && (
            <motion.div
              key={viewingUser.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
            >
              <PublicProfileView user={viewingUser} onBack={() => setViewingUser(null)} setSimConfig={setSimConfig} onNavigate={onNavigate} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ OWN PROFILE (hidden while viewing another user) ═══════ */}
        {!viewingUser && (<>

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
              <div className="profile-header-actions">
                <button className="profile-settings-btn" onClick={() => setSettingsOpen(true)} title="Settings">
                  <Settings size={13} /> Settings
                </button>
                <button className="profile-header-logout" onClick={onLogout} title="Log out">
                  <LogOut size={13} /> Log out
                </button>
              </div>
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
                      return (
                        <motion.div
                          className="profile-simlog-item"
                          key={log.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.3 }}
                          onClick={() => setSelectedLog(log)}
                          title="Click to view saved result"
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
                            <div className="profile-simlog-rerun">View →</div>
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
        </>)}
      </div>
    </div>
  );
}

// ── Public profile view ───────────────────────────────────────────────────────
function PublicProfileView({ user, onBack, setSimConfig, onNavigate }) {
  const [simLogs, setSimLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tryingId, setTryingId] = useState(null);

  useEffect(() => {
    if (!user.is_public) return;
    setLogsLoading(true);
    getPublicSimulationLogs(user.id).then(res => {
      setSimLogs(res.data || []);
      setLogsLoading(false);
    });
  }, [user.id, user.is_public]);

  const initials = (user.full_name || user.username || "U")
    .split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const memberDays = user.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
    : 0;

  const avgHealthy = simLogs.length
    ? (simLogs.reduce((s, l) => s + Number(l.final_healthy_pct), 0) / simLogs.length).toFixed(1)
    : null;

  const fwCount = simLogs.filter(l => l.disease === "fusarium_wilt").length;
  const topDisease = simLogs.length === 0 ? "—"
    : fwCount > simLogs.length - fwCount ? "Fusarium Wilt" : "Black Sigatoka";

  const handleTry = async (log) => {
    if (tryingId) return;
    setTryingId(log.id);
    let imageData = null;
    if (log.image_url) {
      try {
        const res = await fetch(log.image_url);
        const blob = await res.blob();
        imageData = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result?.split(",")[1] ?? null);
          reader.readAsDataURL(blob);
        });
      } catch { /* proceed without image */ }
    }
    setSimConfig?.({ disease: log.disease, temp: Number(log.temp), rh: Number(log.rh), density: log.density, imageData });
    setTryingId(null);
    onNavigate?.("simulation");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <button className="profile-back-btn" onClick={onBack}>
        <ArrowLeft size={15} /> Back to search
      </button>

      {/* Header card */}
      <div className="profile-header-card" style={{ marginBottom: 20 }}>
        <div className="profile-header-bg" />
        <div className="profile-header-content">
          <div className="profile-avatar-wrap" style={{ cursor: "default" }}>
            {user.profile_picture_url
              ? <img src={user.profile_picture_url} alt="Profile" className="profile-avatar-img" />
              : <div className="profile-avatar-placeholder">{initials}</div>
            }
          </div>
          <div className="profile-header-info">
            <div className="profile-header-name">{user.full_name || user.username}</div>
            <div className="profile-header-username">
              @{user.username}
              {user.is_public
                ? <span className="pub-badge pub-badge-public"><Globe size={9} /> Public</span>
                : <span className="pub-badge pub-badge-private"><Lock size={9} /> Private</span>
              }
            </div>
            <div className="profile-header-meta">
              <span><CalendarDays size={11} /> Joined {memberSince}</span>
              {user.is_public && simLogs.length > 0 && <span><Orbit size={11} /> {simLogs.length} simulation{simLogs.length !== 1 ? "s" : ""}</span>}
            </div>
            {user.bio && <div className="profile-header-bio">{user.bio}</div>}
          </div>
        </div>
      </div>

      {user.is_public ? (<>
        {/* Quick stats */}
        {simLogs.length > 0 && (
          <div className="profile-stats-row" style={{ marginBottom: 20 }}>
            <FadeIn delay={0.05}>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: C.amber400 + "18", color: C.amber400 }}><Activity size={16} /></div>
                <div className="profile-stat-value">{simLogs.length}</div>
                <div className="profile-stat-label">Simulations</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: C.green400 + "18", color: C.green400 }}><Shield size={16} /></div>
                <div className="profile-stat-value">{avgHealthy}%</div>
                <div className="profile-stat-label">Avg healthy</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: C.teal600 + "18", color: C.teal600 }}><Orbit size={16} /></div>
                <div className="profile-stat-value" style={{ fontSize: 13 }}>{topDisease}</div>
                <div className="profile-stat-label">Top disease</div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: C.green600 + "18", color: C.green600 }}><CalendarDays size={16} /></div>
                <div className="profile-stat-value">{memberDays}</div>
                <div className="profile-stat-label">Days active</div>
              </div>
            </FadeIn>
          </div>
        )}

        {/* Simulation history */}
        <FadeIn delay={0.15}>
          <div className="profile-card">
            <div className="profile-card-header">
              <Activity size={15} />
              <span>Simulation history</span>
              {simLogs.length > 0 && <span className="profile-card-badge">{simLogs.length}</span>}
            </div>
            {logsLoading ? (
              <div className="profile-hint" style={{ padding: "20px 0", textAlign: "center" }}>Loading…</div>
            ) : simLogs.length === 0 ? (
              <div className="profile-hint" style={{ padding: "20px 0", textAlign: "center" }}>No simulations run yet.</div>
            ) : (
              <div className="profile-simlog-list">
                {simLogs.map((log, i) => {
                  const isFW = log.disease === "fusarium_wilt";
                  const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
                  const diseaseColor = isFW ? C.amber400 : C.teal600;
                  const diseaseBg = isFW ? C.amber50 : C.teal50;
                  return (
                    <motion.div
                      key={log.id}
                      className="profile-simlog-item"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                    >
                      {log.image_url
                        ? <img src={log.image_url} alt="" className="profile-simlog-thumb" />
                        : <div className="profile-simlog-badge" style={{ background: diseaseBg, color: diseaseColor }}>{isFW ? "FW" : "BS"}</div>
                      }
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
                        <button
                          className="profile-simlog-rerun"
                          onClick={() => handleTry(log)}
                          disabled={!!tryingId}
                          style={{ cursor: tryingId ? "wait" : "pointer" }}
                        >
                          {tryingId === log.id ? "Loading…" : "Try →"}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </FadeIn>
      </>) : (
        <div className="profile-public-empty">
          <Lock size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
          <p>This user's profile is private.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Simulation log detail modal ───────────────────────────────────────────────
function SimLogDetailModal({ log, onClose, setSimConfig, onNavigate }) {
  const [rerunning, setRerunning] = useState(false);

  const isFW = log.disease === "fusarium_wilt";
  const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
  const diseaseColor = isFW ? C.amber400 : C.teal600;
  const date = new Date(log.created_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

  const healthy = Number(log.final_healthy_pct);
  const infected = Number(log.final_infected_pct);
  const necrotic = Number(log.final_necrotic_pct);

  const handleRerun = async () => {
    setRerunning(true);
    let imageData = null;
    if (log.image_url) {
      try {
        const res = await fetch(log.image_url);
        const blob = await res.blob();
        imageData = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result?.split(",")[1] ?? null);
          reader.readAsDataURL(blob);
        });
      } catch { /* proceed without image */ }
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
    setRerunning(false);
    onClose();
    onNavigate?.("simulation");
  };

  return (
    <motion.div className="settings-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose}>
      <motion.div
        className="settings-modal simlog-detail-modal"
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title" style={{ color: diseaseColor }}>
            <Activity size={15} /> {diseaseName}
          </div>
          <button className="settings-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Saved image */}
        {log.image_url && (
          <div className="simlog-detail-img-wrap">
            <img src={log.image_url} alt="Simulation result" className="simlog-detail-img" />
          </div>
        )}

        {/* Stats bars */}
        <div className="simlog-detail-bars">
          {[
            { label: "Healthy", pct: healthy, color: C.green600, bg: C.green50 },
            { label: "Infected", pct: infected, color: C.amber400, bg: C.amber50 },
            { label: "Necrotic", pct: necrotic, color: C.red400, bg: C.red50 },
          ].map(({ label, pct, color, bg }) => (
            <div key={label} className="simlog-detail-bar-row">
              <span className="simlog-detail-bar-label" style={{ color }}>{label}</span>
              <div className="simlog-detail-bar-track">
                <div className="simlog-detail-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="simlog-detail-bar-pct" style={{ color }}>{pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {/* Parameters */}
        <div className="settings-section">
          <div className="settings-section-label">Parameters</div>
          {[
            ["Disease", diseaseName],
            ["Temperature", `${log.temp} °C`],
            ["Humidity", `${log.rh}%`],
            ["Density", log.density],
            ["Duration", `${log.months_simulated} months`],
            ["Recorded", date],
          ].map(([k, v]) => (
            <div className="settings-row" key={k} style={{ paddingTop: 6, paddingBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Re-run */}
        <div className="settings-section">
          <button className="settings-save-btn" onClick={handleRerun} disabled={rerunning}>
            <RefreshCw size={13} />
            {rerunning ? "Preparing…" : "Run new simulation with these settings"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
            Results will vary — disease spread is probabilistic.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ profile, theme, setTheme, simLogs, setSimConfig, onClose, onSaved }) {
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? false);
  const [defaultDisease, setDefaultDisease] = useState(profile?.default_disease ?? "black_sigatoka");
  const [defaultTemp, setDefaultTemp] = useState(profile?.default_temp ?? 26);
  const [defaultRh, setDefaultRh] = useState(profile?.default_rh ?? 85);
  const [defaultDensity, setDefaultDensity] = useState(profile?.default_density ?? "medium");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateProfile({ is_public: isPublic, default_disease: defaultDisease, default_temp: Number(defaultTemp), default_rh: Number(defaultRh), default_density: defaultDensity });
    setSaving(false);
    if (res.success) {
      setSimConfig?.(prev => ({ ...prev, disease: defaultDisease, temp: Number(defaultTemp), rh: Number(defaultRh), density: defaultDensity }));
      onSaved?.({ is_public: isPublic, default_disease: defaultDisease, default_temp: Number(defaultTemp), default_rh: Number(defaultRh), default_density: defaultDensity });
      onClose();
    }
  };

  const exportCsv = () => {
    if (!simLogs?.length) return;
    const headers = ["Date", "Disease", "Temp (°C)", "Humidity (%)", "Density", "Healthy (%)", "Infected (%)", "Necrotic (%)", "Months"];
    const rows = simLogs.map(l => [
      new Date(l.created_at).toLocaleDateString(),
      l.disease === "fusarium_wilt" ? "Fusarium Wilt TR4" : "Black Sigatoka",
      l.temp, l.rh, l.density,
      Number(l.final_healthy_pct).toFixed(1),
      Number(l.final_infected_pct).toFixed(1),
      Number(l.final_necrotic_pct).toFixed(1),
      l.months_simulated,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "s-aging-simulations.csv" });
    a.click();
  };

  return (
    <motion.div className="settings-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose}>
      <motion.div className="settings-modal" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title"><Settings size={15} /> Settings</div>
          <button className="settings-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-label">Appearance</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Theme</div>
              <div className="settings-row-desc">Choose how S-Aging looks for you.</div>
            </div>
            <div className="theme-btn-group">
              <button className={`theme-btn${theme === "light" ? " active" : ""}`} onClick={() => setTheme("light")}>
                <Sun size={12} /> Light
              </button>
              <button className={`theme-btn${theme === "dark" ? " active" : ""}`} onClick={() => setTheme("dark")}>
                <Moon size={12} /> Dark
              </button>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="settings-section">
          <div className="settings-section-label">Privacy</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isPublic ? <Globe size={13} /> : <Lock size={13} />}
                {isPublic ? "Public profile" : "Private profile"}
              </div>
              <div className="settings-row-desc">
                {isPublic
                  ? "Other users can find you in search and view your profile."
                  : "You are hidden from search. No one can view your profile."}
              </div>
            </div>
            <div className="settings-toggle" onClick={() => setIsPublic(v => !v)}>
              <div className={`settings-toggle-track${isPublic ? " on" : ""}`}>
                <div className="settings-toggle-thumb" />
              </div>
              <span className="settings-toggle-label">{isPublic ? "On" : "Off"}</span>
            </div>
          </div>
        </div>

        {/* Simulation defaults */}
        <div className="settings-section">
          <div className="settings-section-label">Simulation Defaults</div>
          <div className="settings-row">
            <div className="settings-row-label">Disease</div>
            <select className="settings-select" value={defaultDisease} onChange={e => setDefaultDisease(e.target.value)}>
              <option value="black_sigatoka">Black Sigatoka</option>
              <option value="fusarium_wilt">Fusarium Wilt TR4</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Temperature</div>
              <div className="settings-row-desc">Optimal range: 20–35 °C</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input className="settings-num-input" type="number" min={15} max={40} value={defaultTemp} onChange={e => setDefaultTemp(e.target.value)} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>°C</span>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Humidity</div>
              <div className="settings-row-desc">Optimal range: 60–100 %</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input className="settings-num-input" type="number" min={40} max={100} value={defaultRh} onChange={e => setDefaultRh(e.target.value)} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">Plantation density</div>
            <select className="settings-select" value={defaultDensity} onChange={e => setDefaultDensity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Data */}
        <div className="settings-section">
          <div className="settings-section-label">Data</div>
          <button className="settings-export-btn" onClick={exportCsv} disabled={!simLogs?.length}>
            <Download size={13} />
            {simLogs?.length ? `Export ${simLogs.length} simulation${simLogs.length !== 1 ? "s" : ""} as CSV` : "No simulations to export"}
          </button>
        </div>

        {/* Save */}
        <div className="settings-section">
          <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
            <Check size={14} />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

      </motion.div>
    </motion.div>
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
