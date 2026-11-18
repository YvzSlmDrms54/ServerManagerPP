// App: Processes
SMPP.registerApp({
  id: 'processes', name: 'Processes', icon: '⚙️', single: true, width: 780, height: 520,
  description: 'See what is running and stop it',
  mount(body, win) {
    const S = SMPP;
    let sortKey = 'cpu', filter = '', paused = false;
    body.innerHTML = `
      <div class="tablewrap">
        <div class="toolbar">
          <input class="input" placeholder="Filter by name, user or PID…">
          <label class="muted"><input type="checkbox" data-a="pause"> Pause</label>
          <span class="muted" data-k="sum"></span>
        </div>
        <div class="tscroll"><table class="tbl">
          <thead><tr><th data-s="pid">PID</th><th data-s="name">Name</th><th data-s="user">User</th><th data-s="cpu">CPU %</th><th data-s="mem">Mem %</th><th></th></tr></thead>
          <tbody></tbody>
        </table></div>
      </div>`;
    const tbody = body.querySelector('tbody');
    body.querySelector('input.input').oninput = e => { filter = e.target.value.toLowerCase(); refresh(); };
    body.querySelector('[data-a=pause]').onchange = e => paused = e.target.checked;
    body.querySelectorAll('th[data-s]').forEach(th => th.onclick = () => { sortKey = th.dataset.s; refresh(); });

    let last = null;
    async function refresh(fetchNew) {
      if (fetchNew) { try { last = await S.api('/api/processes'); } catch (e) { return S.toast(e.message, 'error'); } }
      if (!last) return;
      body.querySelector('[data-k=sum]').textContent = `${last.total} processes · ${last.running} running`;
      let rows = last.list.filter(p => !filter || `${p.pid} ${p.name} ${p.user}`.toLowerCase().includes(filter));
      rows.sort((a, b) => typeof a[sortKey] === 'number' ? b[sortKey] - a[sortKey] : String(a[sortKey]).localeCompare(String(b[sortKey])));
      tbody.innerHTML = rows.map(p => `<tr title="${S.esc(p.command)}"><td>${p.pid}</td><td>${S.esc(p.name)}</td><td>${S.esc(p.user)}</td>
        <td>${p.cpu.toFixed(1)}</td><td>${p.mem.toFixed(1)}</td><td><button class="mini danger" data-pid="${p.pid}" data-n="${S.esc(p.name)}">End</button></td></tr>`).join('');
    }
    tbody.onclick = async e => {
      const b = e.target.closest('button[data-pid]');
      if (!b) return;
      if (!await S.confirm(`End process "${b.dataset.n}" (PID ${b.dataset.pid})?`, 'End process', true)) return;
      try { await S.api('/api/processes/kill', { body: { pid: Number(b.dataset.pid) } }); S.toast('Signal sent', 'ok'); setTimeout(() => refresh(true), 600); }
      catch (er) { S.toast(er.message, 'error'); }
    };
    refresh(true);
    const iv = setInterval(() => { if (!paused && !win.minimized) refresh(true); }, 3000);
    win.onClose(() => clearInterval(iv));
  }
});
