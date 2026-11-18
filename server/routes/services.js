// ServerManager++ — systemd services (Linux)
const express = require('express');
const { execFile } = require('child_process');

const router = express.Router();
const UNIT = /^[\w@.\-:]+\.service$/;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(new Error((stderr || err.message).trim()), { code: err.code }));
      resolve(stdout);
    });
  });
}

router.get('/', async (req, res) => {
  if (process.platform !== 'linux') return res.json({ supported: false, list: [] });
  try {
    const out = await run('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--plain', '--no-legend']);
    const list = out.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [unit, load, active, sub, ...desc] = l.split(/\s+/);
      return { unit, load, active, sub, description: desc.join(' ') };
    }).filter(s => UNIT.test(s.unit));
    res.json({ supported: true, list });
  } catch (e) {
    res.json({ supported: false, error: e.code === 'ENOENT' ? 'systemd not found' : e.message, list: [] });
  }
});

router.post('/action', async (req, res) => {
  const { unit, action } = req.body || {};
  if (!UNIT.test(String(unit))) return res.status(400).json({ error: 'Invalid service name' });
  if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try { await run('systemctl', [action, unit]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message || 'Failed (ServerManager++ may need root for this)' }); }
});

router.get('/logs', async (req, res) => {
  const unit = String(req.query.unit);
  if (!UNIT.test(unit)) return res.status(400).json({ error: 'Invalid service name' });
  try { res.json({ logs: await run('journalctl', ['-u', unit, '-n', '200', '--no-pager', '-o', 'short-iso']) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
