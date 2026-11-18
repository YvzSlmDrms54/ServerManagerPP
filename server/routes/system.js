// ServerManager++ — system info + live stats
const express = require('express');
const os = require('os');
const si = require('systeminformation');

const router = express.Router();

router.get('/info', async (req, res) => {
  try {
    const [osInfo, cpu, sys] = await Promise.all([si.osInfo(), si.cpu(), si.system()]);
    res.json({
      hostname: os.hostname(),
      os: `${osInfo.distro} ${osInfo.release}`.trim(),
      kernel: osInfo.kernel,
      arch: osInfo.arch,
      platform: osInfo.platform,
      cpu: `${cpu.manufacturer} ${cpu.brand}`.trim(),
      cores: cpu.cores,
      model: `${sys.manufacturer} ${sys.model}`.trim(),
      node: process.version
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function getStats() {
  const [load, mem, disks, net, temp] = await Promise.all([
    si.currentLoad(), si.mem(), si.fsSize().catch(() => []),
    si.networkStats('*').catch(() => []), si.cpuTemperature().catch(() => ({}))
  ]);
  const seen = new Set();
  return {
    time: Date.now(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    cpu: Math.round(load.currentLoad * 10) / 10,
    cores: load.cpus.map(c => Math.round(c.load)),
    mem: { total: mem.total, used: mem.active, swapTotal: mem.swaptotal, swapUsed: mem.swapused },
    disks: disks
      .filter(d => d.size > 0 && !seen.has(d.fs) && seen.add(d.fs))
      .map(d => ({ mount: d.mount, fs: d.fs, size: d.size, used: d.used })),
    net: {
      rx: net.reduce((a, n) => a + (n.rx_sec || 0), 0),
      tx: net.reduce((a, n) => a + (n.tx_sec || 0), 0)
    },
    temp: temp.main ?? null
  };
}

router.get('/stats', async (req, res) => {
  try { res.json(await getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.getStats = getStats;
