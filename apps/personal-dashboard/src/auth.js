import bcrypt from 'bcryptjs';
import cookieSession from 'cookie-session';
import { getConfig, updateConfig } from './config.js';

export function sessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required (see .env.example)');
  return cookieSession({
    name: 'pd_session',
    secret,
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    httpOnly: true,
    sameSite: 'lax',
  });
}

// Session gate — every data route mounts this. /api/auth/* and /healthz stay open.
export function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export function login(req, res) {
  const { password } = req.body || {};
  const cfg = getConfig();
  if (!password || !cfg.password_hash || !bcrypt.compareSync(password, cfg.password_hash)) {
    return res.status(401).json({ error: 'invalid password' });
  }
  req.session.authed = true;
  res.json({ ok: true });
}

export function logout(req, res) {
  req.session = null;
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ authed: !!(req.session && req.session.authed) });
}

export function changePassword(req, res) {
  const { current, next } = req.body || {};
  const cfg = getConfig();
  if (!current || !bcrypt.compareSync(current, cfg.password_hash)) {
    return res.status(401).json({ error: 'current password is wrong' });
  }
  if (!next || next.length < 4) {
    return res.status(400).json({ error: 'new password too short' });
  }
  updateConfig({ password_hash: bcrypt.hashSync(next, 10) });
  res.json({ ok: true });
}
