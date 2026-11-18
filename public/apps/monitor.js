// App: System Monitor
SMPP.registerApp({
  id: 'monitor', name: 'System Monitor', icon: '📊', single: true, width: 820, height: 560,
  description: 'Live CPU, memory, disk and network',
  mount(body, win) {
    const S = SMPP;
    body.innerHTML = `
      <div class="mon pad">
        <div class="mon-info" data-k="info">Loading system info…</div>
        <div class="mon-grid">
          <div class="card"><div class="card-h">CPU <b data-k="cpu">–</b></div><canvas data-g="cpu"></canvas><div class="cores" data-k="cores"></div></div>
          <div class="card"><div class="card-h">Memory <b data-k="mem">–</b></div><canvas data-g="mem"></canvas><div class="muted" data-k="memd"></div></div>
          <div class="card"><div class="card-h">Network <b data-k="net">–</b></div><canvas data-g="net"></canvas><div class="muted"><span class="dot rx"></span>down <span class="dot tx"></span>up</div></div>
          <div class="card"><div class="card-h">Disks</div><div data-k="disks"></div></div>
        </div>
      </div>`;
    const q = k => body.querySelector(`[data-k="${k}"]`);
    const g = k => body.querySelector(`[data-g="${k}"]`);
    const hist = { cpu: [], mem: [], rx: [], tx: [] };
    const push = (a, v) => { a.push(v); if (a.length > S.GRAPH_POINTS) a.shift(); };

    S.api('/api/system/info').then(i => {
      q('info').innerHTML = `<b>${S.esc(i.hostname)}</b> · ${S.esc(i.os)} · ${S.esc(i.cpu)} (${i.cores} cores) · kernel ${S.esc(i.kernel)} · <span data-k="up"></span>`;
    }).catch(e => q('info').textContent = e.message);

    const unsub = S.stats.subscribe(st => {
      push(hist.cpu, st.cpu);
      push(hist.mem, st.mem.used / st.mem.total * 100);
      push(hist.rx, st.net.rx); push(hist.tx, st.net.tx);
      q('cpu').textContent = `${st.cpu.toFixed(0)}%` + (st.temp ? ` · ${Math.round(st.temp)}°C` : '');
      q('mem').textContent = `${(st.mem.used / st.mem.total * 100).toFixed(0)}%`;
      q('memd').textContent = `${S.fmtBytes(st.mem.used)} / ${S.fmtBytes(st.mem.total)}` +
        (st.mem.swapTotal ? ` · swap ${S.fmtBytes(st.mem.swapUsed)} / ${S.fmtBytes(st.mem.swapTotal)}` : '');
      q('net').textContent = `↓ ${S.fmtBytes(st.net.rx)}/s  ↑ ${S.fmtBytes(st.net.tx)}/s`;
      q('cores').innerHTML = st.cores.map(c => `<div class="core" title="${c}%"><i style="height:${c}%"></i></div>`).join('');
      q('disks').innerHTML = st.disks.map(d => {
        const p = d.used / d.size * 100;
        return `<div class="disk"><div class="disk-h"><span>${S.esc(d.mount)}</span><span>${S.fmtBytes(d.used)} / ${S.fmtBytes(d.size)}</span></div>
          <div class="bar ${p > 90 ? 'hot' : ''}"><i style="width:${p}%"></i></div></div>`;
      }).join('') || '<div class="muted">No disks found</div>';
      const up = q('up'); if (up) up.textContent = `up ${S.fmtUptime(st.uptime)} · load ${st.loadavg.map(l => l.toFixed(2)).join(' ')}`;
      S.drawGraph(g('cpu'), [{ data: hist.cpu, color: '#7c5cff' }], 100);
      S.drawGraph(g('mem'), [{ data: hist.mem, color: '#00c2ff' }], 100);
      S.drawGraph(g('net'), [{ data: hist.rx, color: '#3ddc97' }, { data: hist.tx, color: '#ff8a3d' }]);
    });
    win.onClose(unsub);
  }
});
