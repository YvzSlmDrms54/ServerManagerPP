// ServerManager++ — entry point
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');

const config = require('./config');
const auth = require('./auth');
const terminal = require('./terminal');
const system = require('./routes/system');

const cfg = config.get();
auth.bootstrapFromEnv();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// API
app.use('/api/auth', auth.router);
app.use('/api', auth.requireAuth);
app.use('/api/system', system);
app.use('/api/files', require('./routes/files'));
app.use('/api/processes', require('./routes/processes'));
app.use('/api/services', require('./routes/services'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route' }));

// frontend + vendored libraries
const vendor = pkg => path.dirname(require.resolve(`${pkg}/package.json`));
app.use('/vendor/xterm', express.static(vendor('@xterm/xterm')));
app.use('/vendor/xterm-fit', express.static(vendor('@xterm/addon-fit')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// sockets: live stats + terminals
io.use(auth.socketAuth);
io.on('connection', socket => {
  socket.on('stats:sub', () => socket.join('stats'));
  socket.on('stats:unsub', () => socket.leave('stats'));
  terminal.attach(socket);
});

let busy = false;
setInterval(async () => {
  if (busy || !io.sockets.adapter.rooms.get('stats')?.size) return;
  busy = true;
  try { io.to('stats').emit('stats', await system.getStats()); }
  catch (e) { console.error('[stats]', e.message); }
  finally { busy = false; }
}, 2000);

server.listen(cfg.port, cfg.host, () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  ServerManager++ is running');
  console.log(`  Local:   http://localhost:${cfg.port}`);
  for (const ip of ips) console.log(`  Network: http://${ip}:${cfg.port}`);
  console.log(`  Files root: ${cfg.filesRoot}`);
  console.log(`  Terminal:   ${terminal.hasPty() ? 'node-pty' : 'fallback (install build tools + `npm i node-pty` for best results)'}`);
  if (!cfg.passwordHash) console.log('\n  First run: open the page to set your admin password.');
  console.log('');
});
