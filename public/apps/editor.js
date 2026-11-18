// App: Text Editor (opened from Files)
SMPP.registerApp({
  id: 'editor', name: 'Text Editor', icon: '📝', width: 760, height: 520, hidden: true,
  mount(body, win, args) {
    const S = SMPP;
    let dirty = false;
    body.innerHTML = `
      <div class="editor">
        <div class="toolbar"><button data-a="save">💾 Save</button><span class="muted ed-path"></span><span class="ed-state"></span></div>
        <textarea spellcheck="false" placeholder="Loading…" disabled></textarea>
      </div>`;
    const ta = body.querySelector('textarea');
    const state = body.querySelector('.ed-state');
    body.querySelector('.ed-path').textContent = args.path;

    S.api('/api/files/read?path=' + encodeURIComponent(args.path))
      .then(d => { ta.value = d.content; ta.disabled = false; ta.placeholder = ''; ta.focus(); })
      .catch(e => { ta.placeholder = e.message; S.toast(e.message, 'error'); });

    const mark = d => { dirty = d; state.textContent = d ? '● unsaved' : ''; win.setTitle((d ? '● ' : '') + (args.title || 'Editor')); };
    async function save() {
      try {
        await S.api('/api/files/write', { body: { path: args.path, content: ta.value } });
        mark(false); S.toast('Saved', 'ok'); args.onSaved?.();
      } catch (e) { S.toast(e.message, 'error'); }
    }
    ta.oninput = () => mark(true);
    ta.onkeydown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
      if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); mark(true); }
    };
    body.querySelector('[data-a=save]').onclick = save;
  }
});
