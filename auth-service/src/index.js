import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { register }    from './auth/register.js';
import { login }       from './auth/login.js';
import { logout }      from './auth/logout.js';
import { requireAuth } from './middleware/authMiddleware.js';
import {
  getUserLogs,
  getActivityStats,
  searchLogs,
} from './logging/activityLogger.js';
import { success, failure, ERROR_CODES } from './utils/errorHandler.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await login({ email, password }, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 401).json(result);
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');
  const result = await logout(token, ip(req), req.headers['user-agent']);
  res.status(result.success ? 200 : 400).json(result);
});

// ── Protected routes (require valid session) ──────────────────────────────────

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

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`S-Aging Auth Service running on http://localhost:${PORT}`);
});
