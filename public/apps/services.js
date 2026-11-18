// App: Services (systemd)
SMPP.registerApp({
  id: 'services', name: 'Services', icon: '🧩', single: true, width: 820, height: 540,
  description: 'Start, stop and restart systemd services',
  mount(body, win) {
    const S = SMPP;
    let filter = '', onlyActive = false, data = null;
    body.innerHTML = `
      <div class="tablewrap">
        <div class="toolbar">
          <input class="input" placeholder="Filter services…">
          <label class="muted"><input type="checkbox" data-a="active"> Running only</label>
          <button data-a="refresh">⟳</button>
        </div>
        <div class="tscroll"><table class="tbl">
          <thead><tr><th>Service</th><th>State</th><th>Description</th><th style="width:220px"></th></tr></thead>
          <tbody><tr><td colspan="4" class="muted">Loading…</td></tr></tbody>
        </table></div>
      </div>`;
    const tbody = body.querySelector('tbody');
    body.querySelector('input.input').oninput = e => { filter = e.target.value.toLowerCase(); render(); };
    body.querySelector('[data-a=active]').onchange = e => { onlyActive = e.target.checked; render(); };
    body.querySelector('[data-a=refresh]').onclick = () => load();

    async function load() {
      try { data = await S.api('/api/services'); render(); } catch (e) { S.toast(e.message, 'error'); }
    }
    function render() {
      if (!data) return;
      if (!data.supported) { tbody.innerHTML = `<tr><td colspan="4" class="muted">Services need Linux with systemd. ${S.esc(data.error || '')}</td></tr>`; return; }
      const rows = data.list.filter(s => (!onlyActive || s.active === 'active') && (!filter || (s.unit + s.description).toLowerCase().includes(filter)));
      tbody.innerHTML = rows.map(s => `<tr>
        <td><span class="dot ${s.active === 'active' ? 'on' : s.active === 'failed' ? 'fail' : ''}"></span>${S.esc(s.unit.replace(/\.service$/, ''))}</td>
        <td>${S.esc(s.sub)}</td><td class="muted">${S.esc(s.description)}</td>
        <td class="acts" data-u="${S.esc(s.unit)}">
          ${s.active === 'active' ? '<button class="mini" data-a="restart">Restart</button><button class="mini danger" data-a="stop">Stop</button>' : '<button class="mini" data-a="start">Start</button>'}
          <button class="mini ghost" data-a="logs">Logs</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nothing matches</td></tr>';
    }
    tbody.onclick = async e => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const unit = b.parentElement.dataset.u, action = b.dataset.a;
      if (action === 'logs') return S.wm.open('logviewer', { unit, title: `Logs — ${unit}` });
      if (action === 'stop' && !await S.confirm(`Stop ${unit}?`, 'Stop', true)) return;
      b.disabled = true;
      try { await S.api('/api/services/action', { body: { unit, action } }); S.toast(`${unit}: ${action} OK`, 'ok'); }
      catch (er) { S.toast(er.message, 'error'); }
      load();
    };
    load();
  }
});

// helper app: service log viewer
SMPP.registerApp({
  id: 'logviewer', name: 'Logs', icon: '📜', hidden: true, width: 760, height: 460,
  mount(body, win, args) {
    const S = SMPP;
    body.innerHTML = `<div class="editor"><div class="toolbar"><button data-a="r">⟳ Refresh</button><span class="muted">${S.esc(args.unit)}</span></div><pre class="logs">Loading…</pre></div>`;
    const pre = body.querySelector('pre');
    const load = () => S.api('/api/services/logs?unit=' + encodeURIComponent(args.unit))
      .then(d => { pre.textContent = d.logs || '(no logs)'; pre.scrollTop = pre.scrollHeight; })
      .catch(e => pre.textContent = e.message);
    body.querySelector('[data-a=r]').onclick = load;
    load();
  }
});
