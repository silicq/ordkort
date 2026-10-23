// Your own look (public/js/look.js): filling a card template and cleaning CSS. Removing scripts and handlers from
// a template needs a real DOM and is checked in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';
import { designNotes } from '../src/mcp.js';

const { App } = browser(['public/js/look.js']);
const L = App.look;

test('fields are filled and escaped, unknown ones vanish, sections follow the fields', () => {
  const v = { term: 'et <b>hus</b>', translation: 'house & home', example: '', image: '1', audio: '1' };
  assert.equal(L.fill('{{term}} — {{translation}}', v), 'et &lt;b&gt;hus&lt;/b&gt; — house &amp; home');
  assert.equal(L.fill('{{nope}}{{ term }}', v), 'et &lt;b&gt;hus&lt;/b&gt;');
  assert.equal(L.fill('{{#example}}<i>{{example}}</i>{{/example}}', v), '', 'no example, no section');
  assert.equal(L.fill('{{^example}}none{{/example}}', v), 'none');
  assert.equal(L.fill('{{#translation}}<b>{{translation}}</b>{{/translation}}', v), '<b>house &amp; home</b>');
  assert.equal(L.fill('{{image}}{{audio}}', v), '<span data-slot="image"></span><span data-slot="audio"></span>');
  assert.equal(L.fill('{{image}}', { ...v, image: '' }), '', 'no picture, no slot');
});

test('CSS cannot end the style element, import other files or call addresses', () => {
  const css = L.cleanCss('.a{color:red}</style><script>x</script>@import url(https://evil.example/x.css); .b{background:url("https://evil.example/t.gif")} .c{background:url(javascript:alert(1))}');
  assert.doesNotMatch(css, /<\/?style/i);
  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(css, /evil\.example|javascript:/i);
  assert.match(css, /\.a\{color:red\}/);
  assert.equal(L.cleanCss('x'.repeat(L.MAX + 50)).length, L.MAX);
});

test('the presets use only known fields', () => {
  for (const [name, p] of Object.entries(L.PRESETS)) {
    for (const side of ['front', 'back']) {
      for (const [, f] of String(p[side]).matchAll(/\{\{[#^/]?\s*(\w+)\s*\}\}/g)) assert.ok(L.FIELDS.includes(f), `${name}.${side}: ${f}`);
    }
  }
});

test('the card picture works where an address goes, and pictures from the web come only from the design itself', () => {
  const v = { term: 'x', image: '1' };
  assert.equal(L.fill('<img src="{{image}}" alt="">', v), '<img data-card-image alt="">');
  assert.equal(L.fill('<div style="background: url({{image}})"></div>', v), '<div style="background: var(--card-image)"></div>');
  const look = {
    css: '.a { background: url("https://pics.example/a.jpg") } .b { background: url(https://pics.example/b.png) }',
    front: '<img src="https://pics.example/c.jpg"><img src="https://pics.example/{{term}}.jpg">',
    site: 'body { background: url(\'https://pics.example/a.jpg\') }',
  };
  assert.equal(L.addresses(look).join(' '), 'https://pics.example/a.jpg https://pics.example/b.png https://pics.example/c.jpg',
    'once each, and never an address a word could become part of');
  // until a picture has come, it is not there at all; pictures of the page itself and data: stay
  const css = L.cleanCss('.a{background:url(https://pics.example/a.jpg)} .b{background:url(//evil.example/x)} .c{background:url(/icons/x.svg)} .d{background:url(data:image/png;base64,AAAA)}');
  assert.doesNotMatch(css, /pics\.example|evil\.example/);
  assert.match(css, /url\(\/icons\/x\.svg\)/);
  assert.match(css, /url\(data:image\/png;base64,AAAA\)/);
});

test('a section inside a section opens too, and a section mark never shows as braces', () => {
  const tpl = '{{#example}}<p>{{example}}</p>{{#example_translation}}<p class="tr">{{example_translation}}</p>{{/example_translation}}{{/example}}';
  assert.equal(L.fill(tpl, { example: 'Vi bor her.', example_translation: 'We live here.' }), '<p>Vi bor her.</p><p class="tr">We live here.</p>');
  assert.equal(L.fill(tpl, { example: 'Vi bor her.', example_translation: '' }), '<p>Vi bor her.</p>');
  assert.equal(L.fill(tpl, { example: '', example_translation: 'x' }), '');
  assert.equal(L.fill('{{#term}}a{{/translation}}', { term: 'x' }), 'a', 'a mark without its pair is dropped');
});

test('a shared look\'s card CSS stays inside its scope and is kept as written', () => {
  const css = '.a{background:linear-gradient(var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text}'
    + ' } } body{display:none} @keyframes k{from{opacity:0}to{opacity:1}} .s::after{content:"}"} /* } */ .b{color:red';
  const out = L.scoped(css, '.look-side');
  assert.match(out, /background:linear-gradient\(var\(--a1\),var\(--a2\)\);-webkit-background-clip:text/, 'written as it was');
  assert.match(out, /^@keyframes k\{/, 'keyframes stay outside the scope');
  const inside = out.slice(out.indexOf('@scope (.look-side) {'));
  // braces outside strings and comments balance, and the scope closes only at the very end
  const bare = inside.replace(/"[^"]*"|\/\*[\s\S]*?\*\//g, '');
  let depth = 0, closedEarly = false;
  [...bare].forEach((ch, i) => { if (ch === '{') depth++; if (ch === '}') { depth--; if (!depth && i < bare.trimEnd().length - 1) closedEarly = true; } });
  assert.equal(depth, 0);
  assert.equal(closedEarly, false, 'no stray brace ends the scope');
  assert.match(inside, /body\{display:none\}/, 'the rule stays, but only inside the scope');
  assert.doesNotMatch(out, /\.b\{color:red/, 'an unfinished rule is dropped');
});

test('the AI is told about links only when a template has one that leaves the card', () => {
  const links = (front) => designNotes({ front, back: '', css: '', site: '' }).some((n) => n.startsWith('Links'));
  for (const kept of ['<svg><use href="#icon"/></svg>', "<a href='#top'>", '<a href=#top>', '<a href=" #top">']) assert.equal(links(kept), false, kept);
  for (const gone of ['<a href="https://their.site.example/{{term}}">', '<a href=https://x>', '<image xlink:href="/a.png">']) assert.equal(links(gone), true, gone);
});
