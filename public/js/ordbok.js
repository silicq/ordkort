/* Official data for Norwegian: the ordbokene.no API (Språkrådet and the University of Bergen).
   Gives exact inflection tables, senses, examples and fixed expressions. */
(() => {
  const A = (globalThis.App ||= {}); // a shared file: works both in the browser and on the server
  const API = 'https://ord.uib.no';
  const dictFor = (lang) => (lang === 'nb' ? 'bm' : lang === 'nn' ? 'nn' : null);

  const LABELS = {
    bm: {
      name: 'Bokmålsordboka', sg: 'Entall', pl: 'Flertall', ind: 'Ubestemt', def: 'Bestemt',
      inf: 'infinitiv', pres: 'presens', past: 'preteritum', perf: 'presens perfektum', imp: 'imperativ', pass: 'passiv',
      mf: 'hankjønn / hunkjønn', n: 'intetkjønn', defsg: 'bestemt form', plur: 'flertall', cmp: 'komparativ', sup: 'superlativ', supdef: 'superlativ, bestemt',
      g: { Masc: 'hankjønn', Fem: 'hunkjønn', Neuter: 'intetkjønn' }, art: { Masc: 'en', Fem: 'ei', Neuter: 'et' },
      expr: 'Faste uttrykk', etym: 'Opphav', have: 'har', to: 'å',
    },
    nn: {
      name: 'Nynorskordboka', sg: 'Eintal', pl: 'Fleirtal', ind: 'Ubunden', def: 'Bunden',
      inf: 'infinitiv', pres: 'presens', past: 'preteritum', perf: 'presens perfektum', imp: 'imperativ', pass: 'passiv',
      mf: 'hankjønn / hokjønn', n: 'inkjekjønn', defsg: 'bunden form', plur: 'fleirtal', cmp: 'komparativ', sup: 'superlativ', supdef: 'superlativ, bunden',
      g: { Masc: 'hankjønn', Fem: 'hokjønn', Neuter: 'inkjekjønn' }, art: { Masc: 'ein', Fem: 'ei', Neuter: 'eit' },
      expr: 'Faste uttrykk', etym: 'Opphav', have: 'har', to: 'å',
    },
  };
  const CLASS = {
    NOUN: 'substantiv', VERB: 'verb', ADJ: 'adjektiv', ADV: 'adverb', ADP: 'preposisjon', PRON: 'pronomen',
    DET: 'determinativ', CCONJ: 'konjunksjon', SCONJ: 'subjunksjon', INTJ: 'interjeksjon', NUM: 'tallord',
    EXPR: 'uttrykk', SYM: 'symbol', ABBR: 'forkorting', PROPN: 'egennavn',
  };
  const ABBR = {
    'norr.': 'norrønt', 'ty.': 'tysk', 'lty.': 'lavtysk', 'lat.': 'latin', 'gr.': 'gresk', 'eng.': 'engelsk',
    'fr.': 'fransk', 'fra.': 'fransk', 'it.': 'italiensk', 'sp.': 'spansk', 'sv.': 'svensk', 'da.': 'dansk',
    'nederl.': 'nederlandsk', 'mlat.': 'middelalderlatin', 'gno.': 'gammelnorsk',
  };

  async function getJSON(url, signal) {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('ordbok ' + r.status);
    return r.json();
  }

  const itemText = (it) => {
    if (!it) return '';
    if (it.text) return it.text;
    if (it.lemmas?.length) return it.lemmas.map((l) => l.lemma || l).join(', ');
    if (it.numerator) return `${it.numerator}/${it.denominator}`;
    if (it.id) return ABBR[it.id] || it.id;
    return '';
  };
  const fill = (content, items) => {
    let i = 0;
    return String(content || '').replace(/\$/g, () => itemText(items?.[i++])).replace(/\s+/g, ' ').trim();
  };

  function paradigm(lemmas, L) {
    const forms = {};
    const genders = new Set();
    let wc = '';
    for (const l of lemmas || []) {
      for (const p of l.paradigm_info || []) {
        if (p.to) continue;
        wc ||= p.tags?.[0] || '';
        (p.tags || []).slice(1).forEach((g) => L.g[g] && genders.add(g));
        for (const inf of p.inflection || []) {
          if (!inf.word_form) continue;
          (forms[inf.tags.join('+')] ||= new Set()).add(inf.word_form);
        }
      }
    }
    const get = (...keys) => {
      for (const k of keys) if (forms[k]) return [...forms[k]].join(' / ');
      return '';
    };
    let table = null;
    if (wc === 'NOUN') {
      const arts = [...genders].map((g) => L.art[g]).join('/');
      const sgInd = get('Sing+Ind');
      table = {
        headers: ['', L.sg, L.pl],
        rows: [[L.ind, (arts ? arts + ' ' : '') + sgInd, get('Plur+Ind')], [L.def, get('Sing+Def'), get('Plur+Def')]],
      };
    } else if (wc === 'VERB') {
      const perf = get('<PerfPart>');
      table = {
        headers: null,
        rows: [
          [L.inf, get('Inf') && `${L.to} ${get('Inf')}`], [L.pres, get('Pres')], [L.past, get('Past')],
          [L.perf, perf && `${L.have} ${perf}`], [L.imp, get('Imp') && `${get('Imp')}!`], [L.pass, get('Inf+Pass')],
        ].filter((r) => r[1]),
      };
    } else if (wc === 'ADJ') {
      table = {
        headers: null,
        rows: [
          [L.mf, get('Pos+Masc/Fem+Ind+Sing', 'Pos+Masc/Fem')], [L.n, get('Pos+Neuter+Ind+Sing', 'Pos+Neuter')],
          [L.defsg, get('Pos+Def+Sing')], [L.plur, get('Pos+Plur')], [L.cmp, get('Cmp')],
          [L.sup, get('Sup+Ind')], [L.supdef, get('Sup+Def')],
        ].filter((r) => r[1]),
      };
    } else {
      const all = [...new Set(Object.values(forms).flatMap((s) => [...s]))];
      if (all.length > 1) table = { headers: null, rows: [[CLASS[wc] || '', all.join(', ')]] };
    }
    if (table && !table.rows.length) table = null;
    return { wc, genders: [...genders], table };
  }

  function walk(list, expr, compounds) {
    const senses = [];
    for (const d of list || []) {
      if (d.type_ !== 'definition') continue;
      const s = { expl: [], ex: [], sub: [] };
      const nested = [];
      for (const el of d.elements || []) {
        if (el.type_ === 'explanation') s.expl.push(fill(el.content, el.items));
        else if (el.type_ === 'example') {
          const q = fill(el.quote?.content, el.quote?.items);
          const e = fill(el.explanation?.content, el.explanation?.items);
          if (q) s.ex.push(e ? `${q} – ${e}` : q);
        } else if (el.type_ === 'definition') nested.push(el);
        else if (el.type_ === 'sub_article') {
          const text = (el.lemmas || []).join(', ') || el.article?.lemmas?.[0]?.lemma || '';
          const inner = walk(el.article?.body?.definitions, [], []);
          const meaning = flatten(inner).slice(0, 2).join('; ');
          if (text) expr.push({ text, meaning });
        } else if (el.type_ === 'compound_list') {
          for (const c of el.elements || []) { const w = itemText(c); if (w) compounds.push(w); }
        }
      }
      const subs = walk(nested, expr, compounds);
      if (!s.expl.length && !s.ex.length) senses.push(...subs);
      else { s.sub = subs; senses.push(s); }
    }
    return senses;
  }
  const flatten = (senses) => senses.flatMap((s) => [...s.expl, ...flatten(s.sub || [])]);

  function parse(a, dict) {
    const L = LABELS[dict];
    const { wc, genders, table } = paradigm(a.lemmas, L);
    const expr = [], compounds = [];
    const senses = walk(a.body?.definitions, expr, compounds);
    const etym = (a.body?.etymology || []).map((e) => fill(e.content, e.items)).filter(Boolean).join('; ');
    const pron = (a.body?.pronunciation || []).map((e) => fill(e.content, e.items)).filter(Boolean).join('; ');
    return {
      id: a.article_id,
      lemma: (a.lemmas || []).map((l) => l.lemma).filter((v, i, arr) => arr.indexOf(v) === i).join(', '),
      hgno: a.lemmas?.[0]?.hgno || 0,
      cls: [CLASS[wc] || wc.toLowerCase(), genders.map((g) => L.g[g]).join(' / ')].filter(Boolean).join(', '),
      table, senses, expr, compounds, etym, pron,
    };
  }

  async function lookup(q, lang, signal) {
    const dict = dictFor(lang);
    if (!dict) return null;
    const s = await getJSON(`${API}/api/articles?w=${encodeURIComponent(q)}&dict=${dict}&scope=ei`, signal);
    const ids = (s.articles?.[dict] || []).slice(0, 3);
    const arts = await Promise.all(ids.map((id) => getJSON(`${API}/${dict}/article/${id}.json`, signal).catch(() => null)));
    return { dict, name: LABELS[dict].name, labels: LABELS[dict], articles: arts.filter(Boolean).map((a) => parse(a, dict)) };
  }

  async function suggest(q, lang, signal) {
    const dict = dictFor(lang);
    if (!dict || !q) return [];
    const j = await getJSON(`${API}/api/suggest?q=${encodeURIComponent(q)}&dict=${dict}&n=8&include=ei`, signal);
    const out = [...(j.a?.exact || []), ...(j.a?.inflect || [])].map((x) => x[0]);
    return [...new Set(out)].slice(0, 8);
  }

  const link = (word) => `https://ordbokene.no/nob/bm,nn/${encodeURIComponent(word)}`;

  /* A short summary of the official entry — ground truth for the AI, so that it translates rather than invents */
  function summary(r) {
    if (!r?.articles?.length) return '';
    const out = [];
    for (const a of r.articles.slice(0, 2)) {
      const lines = [`• ${a.lemma} (${a.cls})`];
      if (a.table) {
        const forms = a.table.headers
          ? a.table.rows.flatMap((row) => row.slice(1).map((c, i) => `${row[0]} ${a.table.headers[i + 1]}: ${c}`))
          : a.table.rows.map((row) => `${row[0]}: ${row[1]}`);
        lines.push('  Forms: ' + forms.join('; '));
      }
      a.senses.slice(0, 6).forEach((s, i) => {
        const ex = s.ex.slice(0, 2).map((x) => `"${x}"`).join(', ');
        lines.push(`  ${i + 1}) ${s.expl.join('; ')}${ex ? ' — e.g. ' + ex : ''}`);
      });
      if (a.expr.length) lines.push('  Fixed expressions: ' + a.expr.slice(0, 8).map((x) => `${x.text} (= ${x.meaning})`).join('; '));
      if (a.etym) lines.push('  Etymology: ' + a.etym);
      out.push(lines.join('\n'));
    }
    return `${r.name}:\n${out.join('\n')}`.slice(0, 2600);
  }

  A.ordbok = { supports: (lang) => !!dictFor(lang), lookup, suggest, summary, link, lexin: 'https://lexin.oslomet.no/' };
})();
