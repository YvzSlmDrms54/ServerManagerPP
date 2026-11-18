// ServerManager++ — web terminal over Socket.IO
// Uses node-pty when available; otherwise falls back to `script` (util-linux) for a real PTY.
const { spawn } = require('child_process');
const os = require('os');
const config = require('./config');

let pty = null;
try { pty = require('node-pty'); } catch { /* optional */ }

function defaultShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

function open(cols, rows) {
  const shell = defaultShell();
  const cwd = config.get().filesRoot || os.homedir();
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };

  if (pty) {
    const p = pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd, env });
    return {
      write: d => p.write(d),
      resize: (c, r) => { try { p.resize(c, r); } catch {} },
      onData: fn => p.onData(fn),
      onExit: fn => p.onExit(() => fn()),
      kill: () => { try { p.kill(); } catch {} }
    };
  }

  // fallback: `script` gives the shell a pseudo-terminal without native modules
  const isLinux = process.platform === 'linux';
  const child = isLinux
    ? spawn('script', ['-qfc', `stty cols ${cols} rows ${rows} 2>/dev/null; exec ${shell}`, '/dev/null'], { cwd, env })
    : spawn(shell, process.platform === 'win32' ? [] : ['-i'], { cwd, env });
  return {
    write: d => child.stdin.write(d),
    resize: () => { /* live resize needs node-pty */ },
    onData: fn => { child.stdout.on('data', b => fn(b.toString())); child.stderr.on('data', b => fn(b.toString())); },
    onExit: fn => child.on('exit', fn),
    kill: () => { try { child.kill('SIGHUP'); } catch {} }
  };
}

function attach(socket) {
  const terms = new Map();

  socket.on('term:open', ({ id, cols = 80, rows = 24 } = {}) => {
    if (!id || terms.has(id) || terms.size >= 10) return;
    const t = open(cols | 0 || 80, rows | 0 || 24);
    terms.set(id, t);
    t.onData(data => socket.emit('term:data', { id, data }));
    t.onExit(() => { terms.delete(id); socket.emit('term:exit', { id }); });
    socket.emit('term:ready', { id, mode: pty ? 'pty' : 'fallback' });
  });
  socket.on('term:input', ({ id, data }) => terms.get(id)?.write(String(data)));
  socket.on('term:resize', ({ id, cols, rows }) => terms.get(id)?.resize(cols | 0, rows | 0));
  socket.on('term:close', ({ id }) => { terms.get(id)?.kill(); terms.delete(id); });
  socket.on('disconnect', () => { for (const t of terms.values()) t.kill(); terms.clear(); });
}

module.exports = { attach, hasPty: () => !!pty };
