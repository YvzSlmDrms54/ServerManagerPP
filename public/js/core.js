// ServerManager++ — shared helpers: API, stats bus, UI widgets
window.SMPP = window.SMPP || {};
(function (S) {
  // ---------- API ----------
  S.api = async function (url, opts = {}) {
    const o = { headers: {}, ...opts };
    if (o.body && typeof o.body === 'object' && !(o.body instanceof Blob) && !(o.body instanceof ArrayBuffer)) {
      o.body = JSON.stringify(o.body);
      o.headers['Content-Type'] = 'application/json';
    }
    if (o.body && !o.method) o.method = 'POST';
    const res = await fetch(url, o);
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    if (res.status === 401 && !url.startsWith('/api/auth')) S.onLoggedOut?.();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  };

  // ---------- formatting ----------
  S.fmtBytes = function (b, dec = 1) {
    if (!b && b !== 0) return '–';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(i ? dec : 0)} ${u[i]}`;
  };
  S.fmtUptime = function (s) {
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (d ? `${d}d ` : '') + `${h}h ${m}m`;
  };
  S.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  S.h = function (html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // ---------- socket + stats bus ----------
  S.connectSocket = function () {
    if (S.socket) S.socket.disconnect();
    S.socket = io({ withCredentials: true });
    S.socket.on('stats', st => { S.lastStats = st; S._statsSubs.forEach(fn => fn(st)); });
    S.socket.on('connect', () => { if (S._statsSubs.size) S.socket.emit('stats:sub'); });
    S.socket.on('connect_error', e => { if (e.message === 'unauthorized') S.onLoggedOut?.(); });
    return S.socket;
  };
  S._statsSubs = new Set();
  S.stats = {
    subscribe(fn) {
      S._statsSubs.add(fn);
      if (S._statsSubs.size === 1) S.socket?.emit('stats:sub');
      if (S.lastStats) fn(S.lastStats);
      return () => {
        S._statsSubs.delete(fn);
        if (!S._statsSubs.size) S.socket?.emit('stats:unsub');
      };
    }
  };

  // ---------- toasts ----------
  S.toast = function (msg, type = 'info') {
    const el = S.h(`<div class="toast ${type}">${S.esc(msg)}</div>`);
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3600);
  };

  // ---------- modal dialogs ----------
  function modal(inner, onReady) {
    return new Promise(resolve => {
      const m = document.getElementById('modal');
      m.innerHTML = '';
      const box = S.h(`<div class="modal-box">${inner}</div>`);
      m.appendChild(box);
      m.classList.remove('hidden');
      const done = v => { m.classList.add('hidden'); m.innerHTML = ''; resolve(v); };
      onReady(box, done);
    });
  }
  S.confirm = (text, okLabel = 'OK', danger = false) => modal(
    `<p>${S.esc(text)}</p><div class="modal-btns"><button class="ghost" data-v="0">Cancel</button><button class="${danger ? 'danger' : ''}" data-v="1">${S.esc(okLabel)}</button></div>`,
    (box, done) => {
      box.querySelectorAll('button').forEach(b => b.onclick = () => done(b.dataset.v === '1'));
      box.querySelector('button[data-v="1"]').focus();
    });
  S.prompt = (text, value = '') => modal(
    `<p>${S.esc(text)}</p><input class="input" value="${S.esc(value)}"><div class="modal-btns"><button class="ghost" data-v="0">Cancel</button><button data-v="1">OK</button></div>`,
    (box, done) => {
      const inp = box.querySelector('input');
      inp.focus(); inp.select();
      inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); };
      box.querySelectorAll('button').forEach(b => b.onclick = () => done(b.dataset.v === '1' ? inp.value : null));
    });

  // ---------- context menu ----------
  S.contextMenu = function (x, y, items) {
    const m = document.getElementById('ctxmenu');
    m.innerHTML = '';
    for (const it of items) {
      if (it === '-') { m.appendChild(S.h('<hr>')); continue; }
      const b = S.h(`<button class="${it.danger ? 'danger' : ''}">${S.esc(it.label)}</button>`);
      b.onclick = () => { hide(); it.action(); };
      m.appendChild(b);
    }
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    function hide() { m.classList.add('hidden'); document.removeEventListener('pointerdown', outside, true); }
    function outside(e) { if (!m.contains(e.target)) hide(); }
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
  };

  // ---------- tiny line graph ----------
  S.drawGraph = function (canvas, series, max) {
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(128,128,128,.15)';
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, h * i / 4); c.lineTo(w, h * i / 4); c.stroke(); }
    const top = max || Math.max(1, ...series.flatMap(s => s.data));
    for (const s of series) {
      if (s.data.length < 2) continue;
      const step = w / (S.GRAPH_POINTS - 1);
      const off = S.GRAPH_POINTS - s.data.length;
      c.beginPath();
      s.data.forEach((v, i) => {
        const x = (i + off) * step, y = h - (v / top) * (h - 4) - 2;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.strokeStyle = s.color; c.lineWidth = 2; c.stroke();
      c.lineTo(w, h); c.lineTo(off * step, h); c.closePath();
      c.fillStyle = s.color + '22'; c.fill();
    }
  };
  S.GRAPH_POINTS = 60;

  // ---------- app registry ----------
  S.apps = new Map();
  S.registerApp = app => S.apps.set(app.id, app);
})(window.SMPP);
