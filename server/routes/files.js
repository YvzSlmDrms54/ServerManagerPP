// ServerManager++ — file manager API (locked inside config.filesRoot)
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config');

const router = express.Router();
const MAX_EDIT = 2 * 1024 * 1024; // 2 MB text editor limit

function root() { return config.get().filesRoot; }

// turn a client path ("/docs/a.txt") into a real path, refusing anything outside the root
async function safe(rel = '/') {
  const r = root();
  const abs = path.resolve(r, '.' + path.sep + String(rel));
  const inside = p => p === r || p.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
  if (!inside(abs)) throw Object.assign(new Error('Path outside the files root'), { status: 403 });
  // follow symlinks for things that exist
  try {
    const real = await fsp.realpath(abs);
    const realRoot = await fsp.realpath(r);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep))
      throw Object.assign(new Error('Link points outside the files root'), { status: 403 });
  } catch (e) { if (e.status) throw e; }
  return abs;
}

function toRel(abs) {
  const rel = path.relative(root(), abs).split(path.sep).join('/');
  return '/' + rel;
}

const wrap = fn => (req, res) => fn(req, res).catch(e =>
  res.status(e.status || (e.code === 'ENOENT' ? 404 : e.code === 'EACCES' ? 403 : 500)).json({ error: e.message }));

router.get('/list', wrap(async (req, res) => {
  const dir = await safe(req.query.path);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const items = await Promise.all(entries.map(async e => {
    const full = path.join(dir, e.name);
    let st = null;
    try { st = await fsp.stat(full); } catch { /* broken link */ }
    return {
      name: e.name,
      dir: st ? st.isDirectory() : false,
      size: st ? st.size : 0,
      mtime: st ? st.mtimeMs : 0
    };
  }));
  items.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
  res.json({ path: toRel(dir), root: root(), items });
}));

router.get('/read', wrap(async (req, res) => {
  const file = await safe(req.query.path);
  const st = await fsp.stat(file);
  if (st.isDirectory()) return res.status(400).json({ error: 'That is a folder' });
  if (st.size > MAX_EDIT) return res.status(413).json({ error: 'File is too big to edit (max 2 MB)' });
  const buf = await fsp.readFile(file);
  if (buf.includes(0)) return res.status(415).json({ error: 'Binary file — download it instead' });
  res.json({ path: toRel(file), content: buf.toString('utf8') });
}));

router.post('/write', wrap(async (req, res) => {
  const file = await safe(req.body.path);
  await fsp.writeFile(file, String(req.body.content ?? ''), 'utf8');
  res.json({ ok: true });
}));

router.get('/download', wrap(async (req, res) => {
  const file = await safe(req.query.path);
  res.download(file);
}));

// upload: raw body, file name in ?name=
router.post('/upload', wrap(async (req, res) => {
  const dir = await safe(req.query.path);
  const name = path.basename(String(req.query.name || ''));
  if (!name) return res.status(400).json({ error: 'Missing file name' });
  const dest = await safe(path.posix.join(toRel(dir), name));
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    req.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    req.on('error', reject);
  });
  res.json({ ok: true });
}));

router.post('/mkdir', wrap(async (req, res) => {
  await fsp.mkdir(await safe(req.body.path), { recursive: true });
  res.json({ ok: true });
}));

router.post('/rename', wrap(async (req, res) => {
  await fsp.rename(await safe(req.body.from), await safe(req.body.to));
  res.json({ ok: true });
}));

router.post('/delete', wrap(async (req, res) => {
  const target = await safe(req.body.path);
  if (target === root()) return res.status(400).json({ error: 'Refusing to delete the files root' });
  await fsp.rm(target, { recursive: true, force: false });
  res.json({ ok: true });
}));

module.exports = router;
