// ServerManager++ — boot, lock screen, desktop, start menu, tray
(function (S) {
  const $ = id => document.getElementById(id);
  let setupMode = false;
  let unsubTray = null;

  S.WALLPAPERS = {
    aurora: 'radial-gradient(1200px 600px at 10% 10%, #5b3df5aa, transparent 60%), radial-gradient(900px 600px at 90% 30%, #00c2ffaa, transparent 60%), radial-gradient(900px 700px at 50% 100%, #ff4fa388, transparent 60%), #0b0d1a',
    sunset: 'linear-gradient(160deg, #2b1055 0%, #7597de 45%, #ff9a8b 75%, #ffcf71 100%)',
    forest: 'radial-gradient(1000px 700px at 20% 80%, #1f8a5b99, transparent 60%), radial-gradient(800px 600px at 80% 20%, #4bd18b55, transparent 60%), #08130f',
    ocean: 'linear-gradient(180deg, #021b3a 0%, #034078 50%, #1282a2 100%)',
    ember: 'radial-gradient(900px 600px at 70% 70%, #ff5e3a99, transparent 60%), radial-gradient(700px 500px at 20% 20%, #ffb34755, transparent 60%), #140806',
    mono: 'linear-gradient(135deg, #1c1c1f, #2c2c31)',
    paper: 'linear-gradient(135deg, #f3f0ea, #dcd6cc)'
  };

  S.applyLook = function (cfg) {
    document.body.classList.toggle('theme-light', cfg.theme === 'light');
    document.body.classList.toggle('theme-dark', cfg.theme !== 'light');
    $('desktop').style.background = S.WALLPAPERS[cfg.wallpaper] || S.WALLPAPERS.aurora;
    document.documentElement.style.setProperty('--accent', cfg.accent || '#7c5cff');
    if (cfg.serverName) { $('smName').textContent = cfg.serverName; document.title = `${cfg.serverName} — ServerManager++`; }
  };

  // ---------- clock ----------
  function tick() {
    const d = new Date();
    const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('trayClock').textContent = t;
    $('lockClock').textContent = t;
    $('lockDate').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }
  setInterval(tick, 1000); tick();

  // ---------- boot ----------
  async function boot() {
    let st;
    try { st = await S.api('/api/auth/status'); }
    catch { $('boot').querySelector('.boot-logo').insertAdjacentHTML('afterend', '<p class="boot-err">Server unreachable</p>'); return; }
    await new Promise(r => setTimeout(r, 900));
    $('boot').classList.add('fade');
    setTimeout(() => $('boot').remove(), 400);
    $('lockName').textContent = st.serverName;
    if (st.authed) enterDesktop();
    else showLock(st.setup);
  }

  function showLock(setup) {
    setupMode = setup;
    $('desktop').classList.add('hidden');
    $('taskbar').classList.add('hidden');
    $('lock').classList.remove('hidden');
    $('lockPw2').classList.toggle('hidden', !setup);
    $('lockPw').autocomplete = setup ? 'new-password' : 'current-password';
    $('lockHint').textContent = setup ? 'Welcome! Choose an admin password for this server.' : 'Enter your password';
    $('lockBtn').textContent = setup ? 'Set password' : 'Unlock';
    $('lockError').textContent = '';
    $('lockPw').value = ''; $('lockPw2').value = '';
    setTimeout(() => $('lockPw').focus(), 50);
  }

  $('lockForm').onsubmit = async e => {
    e.preventDefault();
    const pw = $('lockPw').value;
    $('lockError').textContent = '';
    try {
      if (setupMode) {
        if (pw !== $('lockPw2').value) throw new Error("Passwords don't match");
        await S.api('/api/auth/setup', { body: { password: pw } });
      } else {
        await S.api('/api/auth/login', { body: { password: pw } });
      }
      enterDesktop();
    } catch (err) {
      $('lockError').textContent = err.message;
      $('lockForm').classList.add('shake');
      setTimeout(() => $('lockForm').classList.remove('shake'), 400);
    }
  };

  async function enterDesktop() {
    $('lock').classList.add('hidden');
    $('desktop').classList.remove('hidden');
    $('taskbar').classList.remove('hidden');
    S.connectSocket();
    try { S.applyLook(await S.api('/api/settings')); } catch {}
    renderIcons();
    renderStartMenu();
    unsubTray?.();
    unsubTray = S.stats.subscribe(st => {
      $('trayCpu').textContent = `CPU ${Math.round(st.cpu)}%`;
      $('trayMem').textContent = `RAM ${Math.round(st.mem.used / st.mem.total * 100)}%`;
    });
    if (!S._welcomed) { S._welcomed = true; S.toast('Welcome to ServerManager++', 'ok'); }
  }

  S.onLoggedOut = function () {
    if (!$('lock').classList.contains('hidden')) return;
    lockScreen(false);
  };

  async function lockScreen(doLogout) {
    if (doLogout) { try { await S.api('/api/auth/logout', { method: 'POST' }); } catch {} }
    unsubTray?.(); unsubTray = null;
    S.wm.closeAll();
    S.socket?.disconnect();
    S.socket = null;
    hideStart();
    showLock(false);
  }

  // ---------- desktop icons ----------
  function renderIcons() {
    const box = $('icons');
    box.innerHTML = '';
    for (const app of S.apps.values()) {
      if (app.hidden) continue;
      const ic = S.h(`<button class="dicon"><div class="dicon-img">${app.icon}</div><div class="dicon-label">${S.esc(app.name)}</div></button>`);
      ic.ondblclick = () => S.wm.open(app.id);
      ic.onclick = e => {
        box.querySelectorAll('.dicon').forEach(d => d.classList.remove('sel'));
        ic.classList.add('sel');
        if (e.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches) S.wm.open(app.id);
      };
      box.appendChild(ic);
    }
  }

  // ---------- start menu ----------
  function renderStartMenu(filter = '') {
    const list = $('smApps');
    list.innerHTML = '';
    const f = filter.toLowerCase();
    for (const app of S.apps.values()) {
      if (app.hidden || (f && !app.name.toLowerCase().includes(f))) continue;
      const b = S.h(`<button class="sm-app"><span class="sm-ic">${app.icon}</span><span><b>${S.esc(app.name)}</b><small>${S.esc(app.description || '')}</small></span></button>`);
      b.onclick = () => { hideStart(); S.wm.open(app.id); };
      list.appendChild(b);
    }
  }
  function hideStart() { $('startmenu').classList.add('hidden'); }
  $('startBtn').onclick = e => {
    e.stopPropagation();
    const sm = $('startmenu');
    sm.classList.toggle('hidden');
    if (!sm.classList.contains('hidden')) { $('smSearch').value = ''; renderStartMenu(); $('smSearch').focus(); }
  };
  $('smSearch').oninput = e => renderStartMenu(e.target.value);
  $('smSearch').onkeydown = e => {
    if (e.key === 'Enter') $('smApps').querySelector('button')?.click();
    if (e.key === 'Escape') hideStart();
  };
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#startmenu') && !e.target.closest('#startBtn')) hideStart();
  });
  $('startmenu').querySelector('.sm-foot').onclick = e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'lock') lockScreen(false).then(() => {}); // keep session, just lock the view
    if (act === 'logout') lockScreen(true);
  };

  // keyboard shortcut: Alt+T opens a terminal
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key.toLowerCase() === 't' && !$('desktop').classList.contains('hidden')) { e.preventDefault(); S.wm.open('terminal'); }
  });

  boot();
})(window.SMPP);
