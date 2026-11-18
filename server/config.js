// ServerManager++ — config storage (data/config.json)
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = process.env.SMPP_DATA || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'config.json');

const defaults = {
  port: 5454,
  host: '0.0.0.0',
  serverName: os.hostname(),
  filesRoot: os.homedir(),
  passwordHash: null,
  theme: 'dark',
  wallpaper: 'aurora',
  accent: '#7c5cff'
};

let cfg = null;

function load() {
  if (cfg) return cfg;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let stored = {};
  if (fs.existsSync(FILE)) {
    try { stored = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch (e) { console.error('[config] config.json is broken, using defaults:', e.message); }
  }
  cfg = { ...defaults, ...stored };
  // environment variables win
  if (process.env.PORT) cfg.port = Number(process.env.PORT);
  if (process.env.HOST) cfg.host = process.env.HOST;
  if (process.env.FILES_ROOT) cfg.filesRoot = process.env.FILES_ROOT;
  cfg.filesRoot = path.resolve(cfg.filesRoot);
  return cfg;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function get() { return load(); }

function update(patch) {
  Object.assign(load(), patch);
  save();
  return cfg;
}

module.exports = { get, update, save, DATA_DIR };
