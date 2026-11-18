// App: Settings
SMPP.registerApp({
  id: 'settings', name: 'Settings', icon: '🛠️', single: true, width: 640, height: 560,
  description: 'Look, files root, password, about',
  async mount(body, win) {
    const S = SMPP;
    body.innerHTML = '<div class="pad muted">Loading…</div>';
    let cfg;
    try { cfg = await S.api('/api/settings'); } catch (e) { body.innerHTML = `<div class="pad error">${S.esc(e.message)}</div>`; return; }

    body.innerHTML = `
      <div class="settings pad">
        <section><h3>Appearance</h3>
          <label>Server name <input class="input" data-f="serverName" value="${S.esc(cfg.serverName)}"></label>
          <label>Theme
            <select class="input" data-f="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label>Accent color <input type="color" data-f="accent" value="${S.esc(cfg.accent)}"></label>
          <div class="wp-grid">${Object.keys(S.WALLPAPERS).map(k =>
            `<button class="wp ${k === cfg.wallpaper ? 'sel' : ''}" data-wp="${k}" title="${k}" style="background:${S.WALLPAPERS[k]}"></button>`).join('')}</div>
        </section>
        <section><h3>Files</h3>
          <label>Files root (Files app and terminal start here) <input class="input" data-f="filesRoot" value="${S.esc(cfg.filesRoot)}"></label>
        </section>
        <div><button data-a="save">Save settings</button></div>
        <section><h3>Password</h3>
          <label>Current password <input class="input" type="password" data-p="current" autocomplete="current-password"></label>
          <label>New password <input class="input" type="password" data-p="next" autocomplete="new-password"></label>
          <button data-a="pw">Change password</button>
        </section>
        <section><h3>About</h3><div class="about muted">Loading…</div></section>
      </div>`;
    const f = k => body.querySelector(`[data-f="${k}"]`);
    f('theme').value = cfg.theme;
    let wallpaper = cfg.wallpaper;
    const preview = () => S.applyLook({ ...cfg, theme: f('theme').value, accent: f('accent').value, wallpaper, serverName: f('serverName').value });
    f('theme').onchange = preview; f('accent').oninput = preview;
    body.querySelectorAll('.wp').forEach(b => b.onclick = () => {
      wallpaper = b.dataset.wp;
      body.querySelectorAll('.wp').forEach(x => x.classList.toggle('sel', x === b));
      preview();
    });

    body.querySelector('[data-a=save]').onclick = async () => {
      const patch = { serverName: f('serverName').value, theme: f('theme').value, accent: f('accent').value, wallpaper, filesRoot: f('filesRoot').value };
      try { await S.api('/api/settings', { body: patch }); cfg = { ...cfg, ...patch }; S.applyLook(cfg); S.toast('Settings saved', 'ok'); }
      catch (e) { S.toast(e.message, 'error'); }
    };
    body.querySelector('[data-a=pw]').onclick = async () => {
      const current = body.querySelector('[data-p=current]').value, next = body.querySelector('[data-p=next]').value;
      try { await S.api('/api/auth/password', { body: { current, next } }); S.toast('Password changed', 'ok'); body.querySelectorAll('[data-p]').forEach(i => i.value = ''); }
      catch (e) { S.toast(e.message, 'error'); }
    };
    win.onClose(() => S.api('/api/settings').then(S.applyLook).catch(() => {})); // undo unsaved previews

    S.api('/api/system/info').then(i => {
      body.querySelector('.about').innerHTML = `
        <b>ServerManager++</b> v1.0.0 — by mybetasoft / 54Gamez<br>
        ${S.esc(i.hostname)} · ${S.esc(i.os)} (${S.esc(i.arch)})<br>
        ${S.esc(i.cpu)} · ${i.cores} cores<br>
        ${S.esc(i.model)}<br>Node ${S.esc(i.node)} · port ${cfg.port}`;
    }).catch(() => {});
  }
});
