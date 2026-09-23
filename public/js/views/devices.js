/* Device linking: show a QR code / code (renewed every 3 minutes) or type a code by hand. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const MAX_ROUNDS = 5; // after this many renewals, pause until "New code" is pressed

  function offer(mode) {
    let round = 0, timers = [], closed = false, current = null;
    const qrBox = h('div', { class: 'qr-box' }, A.loading(''));
    const codeEl = h('div', { class: 'code-show' }, '····-····-····-····');
    const bar = h('i');
    const timerText = h('span');
    const statusEl = h('p', { class: 'qr-status' }, icon('refresh', 16), h('span', null, t('sync.waiting')));
    const again = h('button', { class: 'btn btn-soft btn-sm', type: 'button', hidden: true, onclick: () => { round = 0; again.hidden = true; next(); } }, icon('refresh', 16), t('sync.refresh'));

    const clear = () => { timers.forEach(clearInterval); timers = []; };

    async function next() {
      clear();
      if (closed) return;
      if (round++ >= MAX_ROUNDS) { again.hidden = false; qrBox.classList.add('dim'); return; }
      qrBox.classList.remove('dim');
      try {
        current = await A.sync.createCode(mode);
      } catch (e) {
        qrBox.replaceChildren(h('p', { class: 'error-text' }, A.sync.errorText(e)));
        again.hidden = false;
        return;
      }
      if (closed) return;
      const url = `${location.origin}/#/link/${current.code}`;
      qrBox.replaceChildren(A.qr.svg(url, { size: 216, dark: '#1d1a16' }));
      codeEl.textContent = A.sync.formatCode(current.code);
      const total = current.expires - Date.now();
      const tick = () => {
        const left = Math.max(0, current.expires - Date.now());
        const s = Math.ceil(left / 1000);
        timerText.textContent = t('sync.expires', { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` });
        bar.style.width = (left / total) * 100 + '%';
        if (left <= 0) next();
      };
      tick();
      timers.push(setInterval(tick, 1000));
      // we find out the code was taken: the mailbox disappeared before it expired
      timers.push(setInterval(async () => {
        if (current.expires - Date.now() < 3000) return;
        const alive = await A.sync.codeAlive(current.slot).catch(() => true);
        if (!alive && !closed) done();
      }, 4000));
    }

    async function done() {
      clear();
      qrBox.classList.add('dim');
      statusEl.className = 'qr-status ok';
      statusEl.replaceChildren(icon('check', 16), h('span', null, t(mode === 'link' ? 'sync.done_link' : 'sync.done_transfer')));
      if (mode === 'link') setTimeout(() => A.sync.syncNow(), 3500);
    }

    const m = A.modal({
      title: t(mode === 'link' ? 'sync.link_title' : 'sync.transfer_title'),
      body: h('div', { class: 'offer' },
        h('p', { class: 'muted small' }, t(mode === 'link' ? 'sync.link_hint' : 'sync.transfer_hint')),
        h('div', { class: 'offer-main' },
          qrBox,
          h('div', { class: 'offer-side' },
            codeEl,
            h('div', { class: 'qr-timer' }, h('div', { class: 'qr-bar' }, bar), timerText),
            statusEl,
            again)),
        h('p', { class: 'small muted safe-note' }, icon('info', 14), t('sync.safe'))),
      onClose: () => { closed = true; clear(); A.refresh(); },
    });
    next();
    return m;
  }

  function enterCode() {
    const input = h('input', { class: 'input code-input', placeholder: t('sync.code_ph'), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 72 });
    const msg = h('p', { class: 'small', hidden: true });
    const btn = h('button', { class: 'btn btn-primary', type: 'button' }, t('sync.connect'));
    input.addEventListener('input', () => {
      const c = A.sync.normCode(input.value).slice(0, A.sync.KEY_LEN);
      const f = c ? A.sync.formatCode(c) : '';
      if (input.value !== f) input.value = f;
    });
    const go = async () => {
      const len = A.sync.normCode(input.value).length;
      if (len !== 16 && len !== A.sync.KEY_LEN) { input.focus(); return; }
      btn.disabled = true;
      msg.hidden = false;
      msg.className = 'small muted';
      msg.textContent = t('sync.connecting');
      try {
        const kind = await A.sync.join(input.value);
        m.close();
        A.persist();
        A.i18n.setRuntime(null);
        A.toast(t(kind === 'link' ? 'sync.joined_link' : 'sync.joined_transfer'), 'ok');
        A.applyTheme();
        A.go('#/');
      } catch (e) {
        msg.className = 'small error-text';
        msg.textContent = A.sync.errorText(e);
        btn.disabled = false;
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    btn.addEventListener('click', go);
    const m = A.modal({
      title: t('sync.enter_title'),
      body: h('div', { class: 'enter-code' },
        h('p', { class: 'muted small' }, t('sync.confirm_text')),
        input, msg,
        h('p', { class: 'small muted safe-note' }, icon('info', 14), t('sync.own_only'))),
      actions: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), btn],
    });
    setTimeout(() => input.focus(), 40);
    return m;
  }

  /* Recovery key: the only way to get the cloud copy back if the data is erased on every device */
  async function showKey() {
    const key = await A.sync.recoveryKey();
    if (!key) return;
    const copy = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, icon('copy', 16), t('sync.copy'));
    copy.addEventListener('click', () => navigator.clipboard?.writeText(key).then(() => A.toast(t('sync.copied'))));
    const save = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, icon('download', 16), t('sync.download_key'));
    save.addEventListener('click', () => {
      const text = `Ordkort — ${t('sync.key_title')}

${key}

${t('sync.key_text')}
${location.origin}
`;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = h('a', { href: url, download: 'ordkort-recovery-key.txt' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    A.modal({
      title: t('sync.key_title'),
      body: h('div', { class: 'enter-code' },
        h('p', { class: 'muted small' }, t('sync.key_text')),
        h('div', { class: 'code-show key-show' }, key),
        h('div', { class: 'row gap wrap' }, copy, save),
        h('p', { class: 'small muted safe-note' }, icon('info', 14), t('sync.key_warn'))),
    });
  }

  /* the "Devices" card on the settings page */
  function card() {
    const el = h('section', { class: 'set-card devices' });
    const draw = () => {
      const st = A.sync.status;
      const on = A.sync.enabled;
      let line;
      if (!on) line = t('sync.off');
      else if (st.state === 'syncing') line = t('sync.on') + ' · …';
      else if (st.state === 'error') line = t('sync.error');
      else line = t('sync.on') + ' · ' + (st.at ? t('sync.last', { time: ago(st.at) }) : t('sync.never'));
      el.replaceChildren(
        h('h2', null, t('sync.title')),
        h('p', { class: 'sync-line' + (on ? ' on' : '') + (st.state === 'error' ? ' bad' : '') }, h('i', { class: 'sync-dot' }), line),
        on
          ? h('div', { class: 'row gap wrap' },
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => offer('link') }, icon('plus', 16), t('sync.add')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => A.sync.syncNow() }, icon('refresh', 16), t('sync.now')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: showKey }, icon('check', 16), t('sync.key')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => offer('transfer') }, icon('upload', 16), t('sync.transfer')))
          : h('div', { class: 'row gap wrap' },
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => offer('link') }, icon('refresh', 16), t('sync.link')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: enterCode }, icon('edit', 16), t('sync.enter')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => offer('transfer') }, icon('upload', 16), t('sync.transfer'))),
        on ? h('div', { class: 'row gap wrap sync-danger' },
          h('button', {
            class: 'link-btn small', type: 'button',
            onclick: async () => { if (await A.confirm(t('sync.unlink_q'), { ok: t('sync.unlink') })) { await A.sync.disable(); draw(); } },
          }, t('sync.unlink')),
          h('button', {
            class: 'link-btn small danger', type: 'button',
            onclick: async () => {
              if (!(await A.confirm(t('sync.delete_q'), { ok: t('sync.delete'), danger: true }))) return;
              try { await A.sync.disable({ deleteRemote: true }); A.toast(t('sync.deleted')); } catch (e) { A.toast(A.sync.errorText(e), 'error'); }
              draw();
            },
          }, t('sync.delete'))) : null,
        h('a', { class: 'link-btn small', href: '#/about' }, icon('info', 14), t('sync.how')));
    };
    draw();
    const off = A.sync.onStatus(() => { if (el.isConnected) draw(); else off(); });
    return el;
  }

  function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    let rtf;
    try { rtf = new Intl.RelativeTimeFormat(A.i18n.lang(), { numeric: 'auto' }); } catch { rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); }
    if (s < 45) return rtf.format(0, 'second');
    if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    return rtf.format(-Math.round(s / 86400), 'day');
  }

  A.devices = { offer, enterCode, card, showKey };
})();
