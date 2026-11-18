// App: Terminal (xterm.js <-> server shell)
SMPP.registerApp({
  id: 'terminal', name: 'Terminal', icon: '⌨️', width: 760, height: 460,
  description: 'A real shell on the server (Alt+T)',
  mount(body, win, args) {
    const S = SMPP;
    const id = 't' + Math.random().toString(36).slice(2);
    body.classList.add('term-body');
    const term = new Terminal({
      cursorBlink: true, fontSize: 14,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace',
      theme: { background: '#0d0f17', foreground: '#e6e6f0', cursor: '#7c5cff', selectionBackground: '#7c5cff55' }
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(body);
    try { fit.fit(); } catch {}

    const sock = S.socket;
    const onData = m => { if (m.id === id) term.write(m.data); };
    const onExit = m => { if (m.id === id) { term.write('\r\n\x1b[90m[process exited — close this window]\x1b[0m\r\n'); } };
    const onReady = m => {
      if (m.id !== id) return;
      if (m.mode === 'fallback') term.write('\x1b[90m(basic terminal mode — install node-pty for full support)\x1b[0m\r\n');
      if (args.cd) sock.emit('term:input', { id, data: `cd ${JSON.stringify(args.cd.startsWith('/') ? '.' + args.cd : args.cd)}\n` });
    };
    sock.on('term:data', onData);
    sock.on('term:exit', onExit);
    sock.on('term:ready', onReady);
    sock.emit('term:open', { id, cols: term.cols, rows: term.rows });
    term.onData(d => sock.emit('term:input', { id, data: d }));

    let t = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        try { fit.fit(); sock.emit('term:resize', { id, cols: term.cols, rows: term.rows }); } catch {}
      }, 80);
    });
    ro.observe(body);
    win.el.addEventListener('pointerdown', () => setTimeout(() => term.focus()));
    term.focus();

    win.onClose(() => {
      ro.disconnect();
      sock.emit('term:close', { id });
      sock.off('term:data', onData); sock.off('term:exit', onExit); sock.off('term:ready', onReady);
      term.dispose();
    });
  }
});
