// Your own look (public/js/look.js): filling a card template and cleaning CSS. Removing scripts and handlers from
// a template needs a real DOM and is checked in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { browser } from './helpers.mjs';

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
