/* Which voice says a card: the site's recordings, or the device's — its default voice or one from the list. Pure. */
(() => {
  const A = window.App;

  const SITE = 'site';
  const DEVICE = 'system';

  const ALIAS = { nb: ['nb', 'no', 'nn'], nn: ['nn', 'nb', 'no'], zh: ['zh-cn', 'cmn', 'zh'], prs: ['fa-af', 'prs', 'fa'], kmr: ['ku', 'kmr'], tl: ['fil', 'tl'], he: ['he', 'iw'] };

  const tag = (v) => String((v && v.lang) || '').toLowerCase().replace('_', '-');

  function list(voices, lang) {
    const codes = ALIAS[lang] || [lang];
    const out = [];
    for (const c of codes) {
      for (const v of voices || []) if (tag(v).startsWith(c) && !out.includes(v)) out.push(v);
    }
    return out;
  }

  function forLang(voices, lang) {
    const fits = list(voices, lang);
    return fits.find((x) => /natural|neural|online|google|enhanced|premium|siri/i.test(x.name)) || fits[0] || null;
  }

  function usesSite(voice) {
    return voice !== DEVICE;
  }

  /* The voice to speak `lang` with, or null for "leave u.voice unset": that is the only way to the system default,
     which on iOS is the Siri voice — a voice getVoices() never lists. */
  function resolve(voices, settings, lang) {
    if (usesSite(settings?.voice)) return forLang(voices, lang);
    const pick = settings?.voiceURI;
    return pick ? (voices || []).find((v) => v.voiceURI === pick) || null : null;
  }

  function langTag(voices, lang) {
    const v = forLang(voices, lang);
    return (v && v.lang) || lang;
  }

  A.voice = { SITE, DEVICE, usesSite, list, forLang, resolve, langTag };
})();
