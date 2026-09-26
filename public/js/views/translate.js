/* Translator with explanations: every word gets its form, part of speech and the rule for why it is used here. */
(() => {
  const A = window.App;
  const { h, icon, t } = A;
  const MAX = 600;
  const POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'article', 'determiner', 'conjunction', 'numeral', 'particle', 'interjection', 'other'];
  const posKey = (p) => { const k = String(p || '').toLowerCase(); return POS.includes(k) ? k : 'other'; };

  const st = { text: '', from: 'auto', to: null, result: null, active: -1, pair: '' };
  let ctrl = null;

  A.views.translate = {
    render(root) {
      const s = A.store.settings;
      const pairId = s.target + ':' + s.native;
      if (st.pair !== pairId) { st.pair = pairId; st.to = s.target; st.from = 'auto'; st.result = null; st.text = ''; }

      const ta = h('textarea', { class: 'tr-input serif', rows: 5, maxlength: MAX, placeholder: t('tr.placeholder'), dir: 'auto', spellcheck: 'false' });
      ta.value = st.text;
      const counter = h('span', { class: 'muted small' }, `${st.text.length} / ${MAX}`);
      const srcView = h('div', { class: 'tr-src-view serif', dir: 'auto', hidden: true, title: t('tr.edit') });
      const out = h('div', { class: 'tr-output serif', dir: 'auto' });
      const outTools = h('div', { class: 'tr-tools' });
      const analysis = h('div', { class: 'tr-analysis' });
      const fromSel = A.langSelect(st.from, { withAuto: true, onChange: (v) => { st.from = v; } });
      const toSel = A.langSelect(st.to, { onChange: (v) => { st.to = v; } });
      const goBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button' }, icon('sparkle', 18), t('tr.go'));

      ta.addEventListener('input', () => {
        st.text = ta.value;
        counter.textContent = `${ta.value.length} / ${MAX}`;
      });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
      srcView.addEventListener('click', (e) => {
        if (e.target.closest('.tk')) return;
        srcView.hidden = true;
        ta.hidden = false;
        ta.focus();
      });

      const swap = h('button', {
        class: 'swap', type: 'button', title: t('tr.swap'), 'aria-label': t('tr.swap'),
        onclick: () => {
          const from = st.from === 'auto' ? (st.result?.source_lang && A.langs.has(st.result.source_lang) ? st.result.source_lang : s.native) : st.from;
          st.from = st.to;
          st.to = from;
          if (st.result?.translation) { st.text = st.result.translation; }
          st.result = null;
          A.route();
        },
      }, icon('swap'));

      async function run() {
        const text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        st.text = text;
        ctrl?.abort();
        ctrl = new AbortController();
        goBtn.disabled = true;
        st.active = -1;
        out.replaceChildren(A.loading(t('tr.working')));
        analysis.replaceChildren(A.skeleton(6));
        const status = (m) => { const el = out.querySelector('.loading-text'); if (el) el.textContent = m; };
        try {
          const r = await A.ai.translate({ text, from: st.from, to: st.to, onStatus: status, signal: ctrl.signal });
          st.result = { ...r, _src: text };
          root.querySelector('.tr-examples')?.remove();
          show();
        } catch (e) {
          if (e.name === 'AbortError') return;
          out.replaceChildren(h('p', { class: 'error-text' }, A.ai.errorText(e)));
          analysis.replaceChildren();
        } finally {
          goBtn.disabled = false;
        }
      }
      goBtn.addEventListener('click', run);

      function show() {
        const r = st.result;
        if (!r) return;
        const toks = Array.isArray(r.tokens) ? r.tokens.filter((x) => x && x.t && !/^[\p{P}\p{S}\s]+$/u.test(x.t)) : [];
        const analyzedIsSource = r.analyzed === 'source';
        const srcLang = r.source_lang || (st.from !== 'auto' ? st.from : '');
        const dstLang = r.target_lang || st.to;
        const aLang = analyzedIsSource ? srcLang : dstLang;
        const oLang = analyzedIsSource ? dstLang : srcLang;

        // the translation, with words highlighted
        const outText = r.translation || '';
        out.replaceChildren(markup(outText, toks, analyzedIsSource ? 'other' : 't', !analyzedIsSource));
        out.lang = dstLang;
        // the source text, highlighted
        srcView.replaceChildren(markup(r._src, toks, analyzedIsSource ? 't' : 'other', analyzedIsSource), h('span', { class: 'src-edit' }, icon('edit', 14)));
        srcView.lang = srcLang;
        srcView.hidden = false;
        ta.hidden = true;

        const detected = st.from === 'auto' && srcLang ? h('span', { class: 'muted small' }, t('tr.detected', { lang: A.langs.name(srcLang) })) : null;
        outTools.replaceChildren(
          detected || h('span'),
          h('span', { class: 'grow' }),
          A.speakBtn(outText, dstLang),
          h('button', {
            class: 'icon-btn sm', type: 'button', title: t('tr.copy'), 'aria-label': t('tr.copy'),
            onclick: () => { navigator.clipboard?.writeText(outText).then(() => A.toast(t('tr.copied'))); },
          }, icon('copy', 18)));

        // the breakdown
        const used = [...new Set(toks.map((x) => posKey(x.pos)))];
        const tokCards = toks.map((x, i) => {
          const pk = posKey(x.pos);
          const ch = A.topics.chapter(x.ch);
          return h('div', { class: 'tok pos-' + pk, 'data-i': i, tabindex: '0', onclick: () => activate(i, 'card'), onkeydown: (e) => { if (e.key === 'Enter') activate(i, 'card'); } },
            h('div', { class: 'tok-head' },
              h('span', { class: 'tok-word serif', lang: aLang, dir: 'auto' }, x.t),
              x.other ? h('span', { class: 'tok-other', lang: oLang, dir: 'auto' }, '← ' + x.other) : null),
            h('div', { class: 'tok-meta' },
              h('span', { class: 'pos-pill' }, t('pos.' + pk)),
              x.lemma && x.lemma.toLowerCase() !== x.t.toLowerCase() ? h('span', { class: 'tok-lemma', lang: aLang }, x.lemma) : null),
            x.form ? h('p', { class: 'tok-form' }, x.form) : null,
            x.why ? h('p', { class: 'tok-why' }, A.rich(x.why)) : null,
            h('div', { class: 'tok-links' },
              ch ? h('a', { class: 'link-btn small', href: '#/grammar/' + ch.id, onclick: (e) => e.stopPropagation() }, icon('grammar', 14), t('ch.' + ch.id)) : null,
              aLang === s.target ? h('a', { class: 'link-btn small', href: '#/dict/' + encodeURIComponent(x.lemma || x.t), onclick: (e) => e.stopPropagation() }, icon('book', 14), t('tr.in_dict')) : null,
              aLang === s.target && x.lemma && pk !== 'other' ? addWordBtn(x, pk) : null));
        });

        A.put(analysis,
          r.alternatives?.length ? h('section', { class: 'tr-sec' },
            h('h3', null, t('tr.alternatives')),
            h('ul', { class: 'alts-list' }, r.alternatives.map((a) => h('li', null, A.lt(a.text, dstLang, 'serif'), a.note ? h('small', { class: 'muted' }, a.note) : null)))) : null,
          toks.length ? h('section', { class: 'tr-sec' },
            h('div', { class: 'block-head wrap' },
              h('h3', null, t('tr.breakdown')),
              h('div', { class: 'pos-legend' }, used.map((p) => h('span', { class: 'pos-' + p }, h('i'), t('pos.' + p))))),
            h('p', { class: 'muted small' }, t('tr.breakdown_hint')),
            h('div', { class: 'tokens' }, tokCards)) : null,
          r.structure ? h('section', { class: 'tr-sec' },
            h('h3', null, t('tr.structure')),
            h('div', { class: 'callout plain' }, icon('info', 20), A.rich(r.structure, 'div'))) : null,
          r.rules?.length ? h('section', { class: 'tr-sec' },
            h('h3', null, t('tr.rules')),
            h('div', { class: 'rules' }, r.rules.map((rule) => {
              const ch = A.topics.chapter(rule.ch);
              return h('div', { class: 'rule' },
                h('h4', null, rule.title),
                h('p', null, A.rich(rule.text)),
                ch ? h('a', { class: 'link-btn small', href: '#/grammar/' + ch.id }, icon('grammar', 14), t('tr.read_chapter', { ch: t('ch.' + ch.id) })) : null);
            }))) : null,
          r.tips?.length ? h('section', { class: 'tr-sec' },
            h('h3', null, t('tr.tips')),
            h('ul', { class: 'ticks' }, r.tips.map((x) => h('li', null, A.rich(x))))) : null,
          h('div', { class: 'tr-foot' },
            h('span', { class: 'muted small' }, icon('sparkle', 14), t('dict.ai_note')),
            A.reportBtn('translate', { text: r._src, from: st.from, to: st.to }, `tr:${s.target}:${s.native}:${st.from}:${st.to}:${r._src}`)));
      }

      /* The card's example: the sentence with the word, and its translation when the sentences of both texts line up.
         The token's "form" is not used as the card's grammar: it describes the form in this text, not the dictionary word. */
      function example(text, other, word) {
        const ex = A.store.sentenceWith(text, word);
        const mine = A.store.sentences(text), theirs = A.store.sentences(other);
        const i = mine.indexOf(ex); // -1 when the sentence had to be cut
        const exTr = i < 0 ? '' : mine.length === 1 ? theirs.join(' ') : mine.length === theirs.length ? theirs[i] : '';
        return { ex, ex_tr: exTr };
      }

      function addWordBtn(x, pk) {
        const b = h('button', { class: 'link-btn small', type: 'button' }, icon('plus', 14), t('tr.add'));
        if (A.store.hasTerm(x.lemma)) { b.disabled = true; b.replaceChildren(icon('check', 14), t('dict.in_cards')); }
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const deckId = await A.pickDeck();
          if (!deckId) return;
          const [text, other] = st.result.analyzed === 'source' ? [st.result._src, st.result.translation] : [st.result.translation, st.result._src];
          const n = A.store.addCards(deckId, [{ term: x.lemma, tr: x.other || '', pos: pk, ...example(text, other, x.t), src: 'tr' }]);
          if (!n && !x.other) { A.toast(t('card.need_both'), 'error'); return; }
          A.toast(n ? t('card.added') : t('card.duplicate'), n ? 'ok' : 'error');
          b.disabled = true;
          b.replaceChildren(icon('check', 14), t('dict.in_cards'));
        });
        return b;
      }

      function activate(i, from) {
        st.active = st.active === i ? -1 : i;
        root.querySelectorAll('.tk, .tok').forEach((el) => {
          const ids = (el.dataset.i || '').split(',');
          el.classList.toggle('active', st.active >= 0 && ids.includes(String(st.active)));
        });
        if (st.active >= 0 && from === 'text') root.querySelector(`.tok[data-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /* Mark up the text: wrap the words found in <span class="tk"> */
      function markup(text, toks, field, sequential) {
        const frag = document.createDocumentFragment();
        const lower = text.toLowerCase();
        const ranges = [];
        const taken = (a, b) => ranges.some((r) => a < r.b && b > r.a);
        let cursor = 0;
        toks.forEach((x, i) => {
          const needle = String(x[field] || '').trim().toLowerCase();
          if (!needle) return;
          const same = ranges.find((r) => lower.slice(r.a, r.b) === needle);
          if (!sequential && same) { same.ids.push(i); return; }
          let idx = findWord(lower, needle, sequential ? cursor : 0, taken);
          if (idx < 0 && sequential) idx = findWord(lower, needle, 0, taken);
          if (idx < 0) return;
          ranges.push({ a: idx, b: idx + needle.length, ids: [i], pos: posKey(x.pos) });
          if (sequential) cursor = idx + needle.length;
        });
        ranges.sort((p, q) => p.a - q.a);
        let pos = 0;
        for (const r of ranges) {
          frag.append(text.slice(pos, r.a));
          const span = h('span', { class: 'tk pos-' + r.pos, 'data-i': r.ids.join(','), onclick: (e) => { e.stopPropagation(); activate(r.ids[0], 'text'); } }, text.slice(r.a, r.b));
          frag.append(span);
          pos = r.b;
        }
        frag.append(text.slice(pos));
        return frag;
      }

      A.add(root,
        h('section', { class: 'page-head' },
          A.rich(t('tr.title'), 'h1'),
          h('p', { class: 'lede' }, t('tr.lede'))),
        h('div', { class: 'tr-panel' },
          h('div', { class: 'tr-box' },
            h('div', { class: 'tr-bar' }, fromSel),
            ta, srcView,
            h('div', { class: 'tr-tools' }, counter, h('span', { class: 'grow' }),
              h('button', { class: 'icon-btn sm', type: 'button', title: t('tr.clear'), 'aria-label': t('tr.clear'), onclick: () => { st.text = ''; st.result = null; A.route(); } }, icon('close', 18)))),
          swap,
          h('div', { class: 'tr-box out' },
            h('div', { class: 'tr-bar' }, toSel),
            out, outTools)),
        h('div', { class: 'row gap center tr-go' }, goBtn, h('span', { class: 'muted small kbd-hint' }, 'Ctrl + Enter')),
        st.result ? null : examples(ta),
        analysis);
      root.querySelector('.page-head h1').className = 'display';

      if (st.result && st.result._src === st.text) show();
      else out.append(h('p', { class: 'placeholder' }, t('tr.out_ph')));
    },
    leave() { ctrl?.abort(); },
  };

  function findWord(hay, needle, from, taken) {
    const isWordChar = (ch) => !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
    let i = hay.indexOf(needle, from);
    let fallback = -1;
    while (i >= 0) {
      if (!taken(i, i + needle.length)) {
        const okL = !isWordChar(hay[i - 1]) || !isWordChar(needle[0]);
        const okR = !isWordChar(hay[i + needle.length]) || !isWordChar(needle[needle.length - 1]);
        if (okL && okR) return i;
        if (fallback < 0) fallback = i;
      }
      i = hay.indexOf(needle, i + 1);
    }
    // languages without spaces (Chinese, Japanese, Thai) have no word boundaries
    return /[぀-ヿ㐀-鿿฀-๿]/.test(needle) ? fallback : -1;
  }

  function examples(ta) {
    const list = [t('tr.ex1'), t('tr.ex2'), t('tr.ex3')];
    return h('div', { class: 'tr-examples' },
      h('span', { class: 'muted small' }, t('tr.try')),
      list.map((x) => h('button', {
        class: 'chip', type: 'button',
        onclick: () => { ta.value = x; ta.dispatchEvent(new Event('input')); ta.focus(); },
      }, x)));
  }
})();
