// App: Files
SMPP.registerApp({
  id: 'files', name: 'Files', icon: '📁', width: 780, height: 520,
  description: 'Browse, edit, upload and download files',
  mount(body, win, args) {
    const S = SMPP;
    let cwd = args.path || '/';
    const history = [];
    body.innerHTML = `
      <div class="files">
        <div class="toolbar">
          <button data-a="back" title="Back">←</button>
          <button data-a="up" title="Up">↑</button>
          <button data-a="refresh" title="Refresh">⟳</button>
          <div class="crumbs"></div>
          <button data-a="newfile">+ File</button>
          <button data-a="newdir">+ Folder</button>
          <button data-a="upload">⤒ Upload</button>
          <input type="file" multiple hidden>
        </div>
        <div class="flist" tabindex="0"></div>
        <div class="statusbar"></div>
      </div>`;
    const list = body.querySelector('.flist');
    const crumbs = body.querySelector('.crumbs');
    const status = body.querySelector('.statusbar');
    const fileInput = body.querySelector('input[type=file]');
    const join = (a, b) => (a.endsWith('/') ? a : a + '/') + b;
    const parent = p => p === '/' ? '/' : p.replace(/\/[^/]+\/?$/, '') || '/';

    const ICONS = { js: '📜', ts: '📜', py: '🐍', json: '🧾', md: '📝', txt: '📝', log: '📜', sh: '⚙️', yml: '⚙️', yaml: '⚙️', conf: '⚙️', properties: '⚙️',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', mp3: '🎵', wav: '🎵', mp4: '🎬', mkv: '🎬',
      zip: '📦', gz: '📦', tar: '📦', jar: '☕', html: '🌐', css: '🎨', pdf: '📕' };
    const iconFor = it => it.dir ? '📁' : (ICONS[it.name.split('.').pop().toLowerCase()] || '📄');

    async function load(p, push = true) {
      try {
        const data = await S.api('/api/files/list?path=' + encodeURIComponent(p));
        if (push && data.path !== cwd) history.push(cwd);
        cwd = data.path;
        win.setTitle('Files — ' + cwd);
        renderCrumbs();
        list.innerHTML = data.items.length ? '' : '<div class="empty">This folder is empty</div>';
        for (const it of data.items) {
          const row = S.h(`<div class="frow"><span class="fic">${iconFor(it)}</span><span class="fname">${S.esc(it.name)}</span>
            <span class="fsize">${it.dir ? '' : S.fmtBytes(it.size)}</span><span class="fdate">${it.mtime ? new Date(it.mtime).toLocaleString() : ''}</span></div>`);
          const full = join(cwd, it.name);
          row.onclick = () => { list.querySelectorAll('.sel').forEach(r => r.classList.remove('sel')); row.classList.add('sel'); };
          row.ondblclick = () => openItem(it, full);
          row.oncontextmenu = e => { e.preventDefault(); row.onclick(); menu(e, it, full); };
          list.appendChild(row);
        }
        status.textContent = `${data.items.length} items · root: ${data.root}`;
      } catch (e) { S.toast(e.message, 'error'); }
    }

    function renderCrumbs() {
      crumbs.innerHTML = '';
      const parts = cwd.split('/').filter(Boolean);
      const mk = (label, p) => { const b = S.h(`<button>${S.esc(label)}</button>`); b.onclick = () => load(p); crumbs.appendChild(b); };
      mk('🏠', '/');
      parts.forEach((part, i) => { crumbs.appendChild(S.h('<span>/</span>')); mk(part, '/' + parts.slice(0, i + 1).join('/')); });
    }

    function openItem(it, full) {
      if (it.dir) return load(full);
      S.wm.open('editor', { path: full, title: it.name, onSaved: () => load(cwd, false) });
    }
    const download = full => { location.href = '/api/files/download?path=' + encodeURIComponent(full); };

    function menu(e, it, full) {
      S.contextMenu(e.clientX, e.clientY, [
        { label: it.dir ? 'Open' : 'Edit', action: () => openItem(it, full) },
        ...(it.dir ? [{ label: 'Open in Terminal', action: () => S.wm.open('terminal', { cd: full }) }] : [{ label: 'Download', action: () => download(full) }]),
        { label: 'Rename', action: async () => {
          const n = await S.prompt('New name:', it.name);
          if (!n || n === it.name) return;
          try { await S.api('/api/files/rename', { body: { from: full, to: join(cwd, n) } }); load(cwd, false); } catch (er) { S.toast(er.message, 'error'); }
        } },
        '-',
        { label: 'Delete', danger: true, action: async () => {
          if (!await S.confirm(`Delete "${it.name}"${it.dir ? ' and everything inside it' : ''}?`, 'Delete', true)) return;
          try { await S.api('/api/files/delete', { body: { path: full } }); S.toast('Deleted', 'ok'); load(cwd, false); } catch (er) { S.toast(er.message, 'error'); }
        } }
      ]);
    }

    async function upload(files) {
      for (const f of files) {
        status.textContent = `Uploading ${f.name}…`;
        try {
          const res = await fetch(`/api/files/upload?path=${encodeURIComponent(cwd)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
        } catch (e) { S.toast(`${f.name}: ${e.message}`, 'error'); }
      }
      S.toast(`Uploaded ${files.length} file(s)`, 'ok');
      load(cwd, false);
    }

    body.querySelector('.toolbar').onclick = async e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'back' && history.length) load(history.pop(), false);
      if (a === 'up') load(parent(cwd));
      if (a === 'refresh') load(cwd, false);
      if (a === 'upload') fileInput.click();
      if (a === 'newdir' || a === 'newfile') {
        const n = await S.prompt(a === 'newdir' ? 'Folder name:' : 'File name:', a === 'newdir' ? 'New folder' : 'new.txt');
        if (!n) return;
        try {
          if (a === 'newdir') await S.api('/api/files/mkdir', { body: { path: join(cwd, n) } });
          else await S.api('/api/files/write', { body: { path: join(cwd, n), content: '' } });
          load(cwd, false);
        } catch (er) { S.toast(er.message, 'error'); }
      }
    };
    fileInput.onchange = () => { if (fileInput.files.length) upload([...fileInput.files]); fileInput.value = ''; };
    list.ondragover = e => { e.preventDefault(); list.classList.add('drop'); };
    list.ondragleave = () => list.classList.remove('drop');
    list.ondrop = e => { e.preventDefault(); list.classList.remove('drop'); if (e.dataTransfer.files.length) upload([...e.dataTransfer.files]); };

    load(cwd, false);
  }
});
