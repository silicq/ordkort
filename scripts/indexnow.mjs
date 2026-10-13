/* Tells search engines that support IndexNow (Bing, Yandex, Seznam, Naver…) about every page in the sitemap,
   so new and changed pages are crawled soon instead of whenever the crawler comes by. Google does not use
   IndexNow; it reads the sitemap from Search Console. Run after a deploy that adds or changes pages:

     npm run indexnow

   The key is the name of the .txt file in public/ that holds it; the engines fetch it to check the site is ours. */
import { readdirSync } from 'node:fs';

const PUBLIC = new URL('../public/', import.meta.url);
const file = readdirSync(PUBLIC).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!file) throw new Error('no IndexNow key file in public/');
const key = file.slice(0, -4);
// the deployed sitemap, not the local one: only pages that are live are announced
const SITE = process.argv[2] || 'https://ordkort.com';
const xml = await (await fetch(SITE + '/sitemap.xml')).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const host = new URL(SITE).host;

// at most 10,000 URLs per request
for (let i = 0; i < urls.length; i += 10000) {
  const part = urls.slice(i, i + 10000);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/${file}`, urlList: part }),
  });
  console.log(`${part.length} URLs: HTTP ${res.status} ${res.status === 200 || res.status === 202 ? 'accepted' : await res.text()}`);
}
