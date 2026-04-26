import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

import { register }    from './auth/register.js';
import { login }       from './auth/login.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { logActivity, getUserLogs, getActivityStats, searchLogs } from './logging/activityLogger.js';
import {
  getUserProfile,
  updateUsername,
  updatePassword,
  updateProfile,
} from './profile/profileManager.js';
import { uploadProfilePicture, deleteProfilePicture } from './profile/pictureUpload.js';
import { supabase } from './config/supabase.js';
import { success, failure, ERROR_CODES } from './utils/errorHandler.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Multer: in-memory storage for profile picture uploads ─────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;
}

// ── Public routes ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'S-Aging Auth Service' });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  const result = await register({ email, username, password }, ip(req), req.headers['user-agent']);
  res.status(result.success ? 201 : 400).json(result);
});

// Optional: keep /login for activity logging convenience. Frontend can also sign in directly with Supabase.
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await login({ email, password }, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 401).json(result);
});

// Logout: just log the activity. Real session invalidation happens via Supabase signOut on the client.
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await logActivity(req.userId, 'user_logout', {
    logout_time: new Date().toISOString(),
  }, ip(req), req.headers['user-agent']);
  // Best-effort: revoke Supabase session server-side
  try { await supabase.auth.admin.signOut(req.sessionToken); } catch { /* ignore */ }
  res.json(success({ logged_out_at: new Date().toISOString() }, 'You have been logged out.'));
});

// ── Protected routes (Supabase JWT required) ──────────────────────────────────

// ── Activity logs ──

app.get('/api/logs', requireAuth, async (req, res) => {
  const limit  = parseInt(req.query.limit)  || 20;
  const offset = parseInt(req.query.offset) || 0;
  const result = await getUserLogs(req.userId, limit, offset);
  res.status(result.success ? 200 : 500).json(result);
});

app.get('/api/logs/stats', requireAuth, async (req, res) => {
  const result = await getActivityStats(req.userId);
  res.status(result.success ? 200 : 500).json(result);
});

app.get('/api/logs/search', requireAuth, async (req, res) => {
  const { action, from, to } = req.query;
  const result = await searchLogs(req.userId, action || null, { from, to });
  res.status(result.success ? 200 : 500).json(result);
});

// ── Profile ──

app.get('/api/profile', requireAuth, async (req, res) => {
  const result = await getUserProfile(req.userId);
  res.status(result.success ? 200 : 404).json(result);
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { full_name, bio, phone } = req.body;
  const result = await updateProfile(req.userId, { full_name, bio, phone }, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 400).json(result);
});

app.put('/api/profile/username', requireAuth, async (req, res) => {
  const { new_username } = req.body;
  const result = await updateUsername(req.userId, new_username, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 400).json(result);
});

app.put('/api/profile/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const result = await updatePassword(
    req.userId, current_password, new_password,
    null, ip(req), req.headers['user-agent']
  );
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/profile/picture', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json(failure(ERROR_CODES.VALIDATION_FAILED, 'No file uploaded.'));
  }
  const result = await uploadProfilePicture(req.userId, req.file, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/api/profile/picture', requireAuth, async (req, res) => {
  const result = await deleteProfilePicture(req.userId, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 400).json(result);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`S-Aging Auth Service running on http://localhost:${PORT}`);
});
