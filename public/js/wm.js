// ServerManager++ — window manager
(function (S) {
  const WM = S.wm = { wins: new Map(), z: 100, seq: 0 };
  const layer = () => document.getElementById('windows');
  const tasks = () => document.getElementById('tasks');

  WM.open = function (appId, args = {}) {
    const app = S.apps.get(appId);
    if (!app) return S.toast(`Unknown app: ${appId}`, 'error');
    if (app.single) {
      const existing = [...WM.wins.values()].find(w => w.app.id === appId);
      if (existing) { WM.restore(existing); return existing; }
    }
    const id = 'w' + (++WM.seq);
    const mobile = innerWidth < 700;
    const W = Math.min(app.width || 720, innerWidth - 20);
    const H = Math.min(app.height || 480, innerHeight - 70);
    const n = WM.wins.size % 8;
    const el = S.h(`
      <div class="window" data-id="${id}">
        <div class="titlebar">
          <span class="t-icon">${app.icon}</span>
          <span class="t-title">${S.esc(args.title || app.name)}</span>
          <div class="t-btns">
            <button class="t-min" title="Minimize">–</button>
            <button class="t-max" title="Maximize">□</button>
            <button class="t-close" title="Close">✕</button>
          </div>
        </div>
        <div class="wbody"></div>
        <div class="resize"></div>
      </div>`);
    Object.assign(el.style, {
      width: W + 'px', height: H + 'px',
      left: Math.max(5, (innerWidth - W) / 2 - 120 + n * 30) + 'px',
      top: Math.max(5, (innerHeight - 48 - H) / 2 - 60 + n * 30) + 'px'
    });
    layer().appendChild(el);

    const task = S.h(`<button class="task"><span>${app.icon}</span><span class="task-label">${S.esc(args.title || app.name)}</span></button>`);
    tasks().appendChild(task);

    const win = { id, app, el, task, body: el.querySelector('.wbody'), cleanups: [], minimized: false };
    WM.wins.set(id, win);

    win.setTitle = t => { el.querySelector('.t-title').textContent = t; task.querySelector('.task-label').textContent = t; };
    win.onClose = fn => win.cleanups.push(fn);
    win.close = () => WM.close(win);

    // focus / buttons
    el.addEventListener('pointerdown', () => WM.focus(win));
    el.querySelector('.t-close').onclick = () => WM.close(win);
    el.querySelector('.t-min').onclick = e => { e.stopPropagation(); WM.minimize(win); };
    el.querySelector('.t-max').onclick = () => el.classList.toggle('max');
    el.querySelector('.titlebar').ondblclick = e => { if (!e.target.closest('button')) el.classList.toggle('max'); };
    task.onclick = () => {
      if (win.minimized) WM.restore(win);
      else if (el.classList.contains('focused')) WM.minimize(win);
      else WM.focus(win);
    };

    dragify(win);
    if (mobile) el.classList.add('max');
    WM.focus(win);
    try { app.mount(win.body, win, args); }
    catch (e) { console.error(e); win.body.innerHTML = `<div class="pad error">App crashed: ${S.esc(e.message)}</div>`; }
    return win;
  };

  WM.focus = function (win) {
    for (const w of WM.wins.values()) { w.el.classList.remove('focused'); w.task.classList.remove('active'); }
    win.el.style.zIndex = ++WM.z;
    win.el.classList.add('focused');
    win.task.classList.add('active');
  };
  WM.minimize = function (win) {
    win.minimized = true;
    win.el.classList.add('minimized');
    win.el.classList.remove('focused');
    win.task.classList.remove('active');
  };
  WM.restore = function (win) {
    win.minimized = false;
    win.el.classList.remove('minimized');
    WM.focus(win);
  };
  WM.close = function (win) {
    for (const fn of win.cleanups) { try { fn(); } catch (e) { console.error(e); } }
    win.el.classList.add('closing');
    setTimeout(() => win.el.remove(), 140);
    win.task.remove();
    WM.wins.delete(win.id);
  };
  WM.closeAll = function () { for (const w of [...WM.wins.values()]) WM.close(w); };

  function dragify(win) {
    const el = win.el, bar = el.querySelector('.titlebar'), grip = el.querySelector('.resize');
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || el.classList.contains('max')) return;
      const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = ev => {
        el.style.left = Math.min(innerWidth - 80, Math.max(-el.offsetWidth + 80, ev.clientX - sx)) + 'px';
        el.style.top = Math.min(innerHeight - 90, Math.max(0, ev.clientY - sy)) + 'px';
      };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
    grip.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        el.style.width = Math.max(320, sw + ev.clientX - sx) + 'px';
        el.style.height = Math.max(200, sh + ev.clientY - sy) + 'px';
      };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }
})(window.SMPP);
