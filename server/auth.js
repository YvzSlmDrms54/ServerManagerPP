// ServerManager++ — password + session auth
const crypto = require('crypto');
const express = require('express');
const config = require('./config');

const COOKIE = 'smpp_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const sessions = new Map(); // token -> { created, lastSeen }
const failures = new Map(); // ip -> { count, until }

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [, saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, got);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isValid(token) {
  const s = token && sessions.get(token);
  if (!s) return false;
  if (Date.now() - s.lastSeen > SESSION_TTL) { sessions.delete(token); return false; }
  s.lastSeen = Date.now();
  return true;
}

function tokenFrom(req) { return parseCookies(req.headers.cookie)[COOKIE]; }

function startSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { created: Date.now(), lastSeen: Date.now() });
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`);
}

function rateLimited(ip) {
  const f = failures.get(ip);
  return f && f.count >= 5 && Date.now() < f.until;
}
function noteFailure(ip) {
  const f = failures.get(ip) || { count: 0, until: 0 };
  if (Date.now() > f.until) f.count = 0;
  f.count++;
  f.until = Date.now() + 5 * 60 * 1000;
  failures.set(ip, f);
}

const router = express.Router();

router.get('/status', (req, res) => {
  const cfg = config.get();
  res.json({ setup: !cfg.passwordHash, authed: isValid(tokenFrom(req)), serverName: cfg.serverName });
});

// first run: choose the admin password
router.post('/setup', (req, res) => {
  if (config.get().passwordHash) return res.status(409).json({ error: 'Already set up' });
  const pw = String(req.body?.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  config.update({ passwordHash: hashPassword(pw) });
  startSession(res);
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many attempts. Wait 5 minutes.' });
  if (!verifyPassword(String(req.body?.password || ''), config.get().passwordHash)) {
    noteFailure(ip);
    return res.status(401).json({ error: 'Wrong password' });
  }
  failures.delete(ip);
  startSession(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  sessions.delete(tokenFrom(req));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

router.post('/password', (req, res) => {
  if (!isValid(tokenFrom(req))) return res.status(401).json({ error: 'Not logged in' });
  const { current, next } = req.body || {};
  if (!verifyPassword(String(current || ''), config.get().passwordHash))
    return res.status(401).json({ error: 'Current password is wrong' });
  if (String(next || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  config.update({ passwordHash: hashPassword(String(next)) });
  // log out every other session
  const keep = tokenFrom(req);
  for (const t of sessions.keys()) if (t !== keep) sessions.delete(t);
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (isValid(tokenFrom(req))) return next();
  res.status(401).json({ error: 'Not logged in' });
}

function socketAuth(socket, next) {
  const token = parseCookies(socket.handshake.headers.cookie)[COOKIE];
  if (isValid(token)) return next();
  next(new Error('unauthorized'));
}

// optional: set the password from the environment on first start
function bootstrapFromEnv() {
  if (!config.get().passwordHash && process.env.SMPP_PASSWORD) {
    config.update({ passwordHash: hashPassword(process.env.SMPP_PASSWORD) });
    console.log('[auth] Admin password set from SMPP_PASSWORD');
  }
}

module.exports = { router, requireAuth, socketAuth, bootstrapFromEnv };
