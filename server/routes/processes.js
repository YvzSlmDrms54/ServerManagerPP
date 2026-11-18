// ServerManager++ — process list + kill
const express = require('express');
const si = require('systeminformation');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const p = await si.processes();
    const list = p.list
      .map(x => ({ pid: x.pid, name: x.name, user: x.user, cpu: x.cpu, mem: x.mem, command: x.command, state: x.state }))
      .sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
      .slice(0, 150);
    res.json({ total: p.all, running: p.running, list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/kill', (req, res) => {
  const pid = Number(req.body?.pid);
  const signal = req.body?.force ? 'SIGKILL' : 'SIGTERM';
  if (!Number.isInteger(pid) || pid <= 1) return res.status(400).json({ error: 'Invalid PID' });
  if (pid === process.pid) return res.status(400).json({ error: "That's ServerManager++ itself" });
  try { process.kill(pid, signal); res.json({ ok: true }); }
  catch (e) { res.status(e.code === 'EPERM' ? 403 : 500).json({ error: e.code === 'EPERM' ? 'Permission denied (needs root)' : e.message }); }
});

module.exports = router;
