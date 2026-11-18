// ServerManager++ — user-facing settings
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();
const PUBLIC = ['serverName', 'theme', 'wallpaper', 'accent', 'filesRoot', 'port'];

router.get('/', (req, res) => {
  const cfg = config.get();
  res.json(Object.fromEntries(PUBLIC.map(k => [k, cfg[k]])));
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (typeof b.serverName === 'string' && b.serverName.trim()) patch.serverName = b.serverName.trim().slice(0, 40);
  if (['dark', 'light'].includes(b.theme)) patch.theme = b.theme;
  if (typeof b.wallpaper === 'string') patch.wallpaper = b.wallpaper.slice(0, 40);
  if (/^#[0-9a-f]{6}$/i.test(b.accent || '')) patch.accent = b.accent;
  if (typeof b.filesRoot === 'string') {
    const p = path.resolve(b.filesRoot);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return res.status(400).json({ error: 'Files root must be an existing folder' });
    patch.filesRoot = p;
  }
  config.update(patch);
  res.json({ ok: true });
});

module.exports = router;
