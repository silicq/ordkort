/* Groq client. The key lives only in the Worker secret (GROQ_API_KEY); the browser never sees it.
   When one model hits its limit we switch to the next one; the answer is always JSON. */
import { HttpError } from './util.js';

const URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// models that hit their limit are skipped until the given time (within this isolate)
const blockedUntil = new Map();

function parseJSON(text) {
  if (!text) throw new Error('empty');
  const s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1));
}

function retryDelay(res, data) {
  const h = parseFloat(res.headers.get('retry-after'));
  if (h > 0) return h * 1000;
  const m = /try again in ([\d.]+)\s*(ms|s)/i.exec(data?.error?.message || '');
  if (m) return parseFloat(m[1]) * (m[2] === 'ms' ? 1 : 1000);
  return 8000;
}

const siteModels = (env) => (env.GROQ_MODELS ? String(env.GROQ_MODELS).split(',').map((s) => s.trim()) : DEFAULT_MODELS).filter(Boolean);

export async function groq(env, { system, user, max = 2500, temperature = 0.35, effort = 'low', models = siteModels(env) }) {
  if (!env.GROQ_API_KEY) throw new HttpError(503, 'not_configured');
  let waited = 0;
  let room = max; // the answer's token limit; lowered when the plan's per-minute limit cannot fit the request

  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now();
    const model = models.find((m) => !((blockedUntil.get(m) || 0) > now));
    if (!model) {
      const wait = Math.min(...models.map((m) => blockedUntil.get(m))) - now;
      if (!isFinite(wait) || wait + waited > 15000) throw new HttpError(503, 'busy');
      waited += wait;
      await sleep(wait + 200);
      continue;
    }
    const body = {
      model, temperature, max_completion_tokens: room,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    };
    if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = effort;

    let res, data;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => null);
    } catch {
      blockedUntil.set(model, Date.now() + 3000);
      continue;
    }

    if (res.ok) {
      try { return parseJSON(data?.choices?.[0]?.message?.content); }
      catch { blockedUntil.set(model, Date.now() + 5000); continue; }
    }
    const code = data?.error?.code || '';
    const msg = data?.error?.message || '';
    if (res.status === 401) { console.error('groq: invalid key'); throw new HttpError(503, 'not_configured'); }
    // "Request too large … tokens per minute (TPM): Limit 8000, Requested 8526": the prompt and the answer's limit
    // together do not fit the plan's per-minute budget; a smaller limit for the answer usually still holds it
    const tpm = res.status === 413 && /Limit (\d+), Requested (\d+)/.exec(msg);
    if (tpm && room - (tpm[2] - tpm[1]) - 200 >= 1500) { room -= tpm[2] - tpm[1] + 200; continue; }
    if (res.status === 413 || code === 'context_length_exceeded') throw new HttpError(413, 'too_long');
    if (res.status === 429) { blockedUntil.set(model, Date.now() + retryDelay(res, data)); continue; }
    if (code === 'json_validate_failed') {
      try { return parseJSON(data?.error?.failed_generation); } catch { /* try another model */ }
      blockedUntil.set(model, Date.now() + 5000);
      continue;
    }
    if (res.status === 404 || /model_not_found|decommissioned/.test(code + msg)) {
      blockedUntil.set(model, Date.now() + 36e5);
      continue;
    }
    console.error('groq error', res.status, code);
    blockedUntil.set(model, Date.now() + 3000);
  }
  throw new HttpError(503, 'busy');
}

/* Moderation: is a text, or a picture, fine for a public library of decks? → { safe, cats } — cats: the hazard
   categories found (S1…S14 as Llama Guard named them: violent crimes, sexual content, weapons, hate…).
   A model told the policy reads the text (gpt-oss-safeguard first, then the site's own models); a text too long for
   the plan's per-minute limit is read in halves. A picture is looked at by a model that sees pictures (Qwen).
   GUARD_MODEL may name a Llama Guard to ask first. Throws (503, with what went wrong) when nothing can answer:
   nothing is let through unchecked. */
const POLICY_MODELS = ['openai/gpt-oss-safeguard-20b'];
const VISION_MODELS = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
const POLICY = `You moderate a public library of vocabulary decks for language learners. Decide whether the deck may be listed.
Ordinary vocabulary is fine even when it names sensitive things: body parts, illnesses, medicine and pills, alcohol, police, crime, war, weapons, death, swear words in a lesson about them.
It is NOT fine when the deck as a whole is sexually explicit or pornographic (S12), sexualises minors (S4), promotes or explains buying, making or using illegal drugs (S2), explains making weapons or explosives (S9), incites violence or terrorism (S1), is hateful or harassing towards a group or a person (S10), encourages self-harm (S11), or shares private data about a real person (S7).
When a picture is given, judge the picture: nudity or sexual content (S12), anything sexual involving minors (S4), gore or cruelty (S1), drug use or drug sale (S2), hate symbols (S10) are not fine; an ordinary photo or drawing is.
Answer only JSON: {"safe": true} or {"safe": false, "cats": ["S12"]}.`;

const verdict = (a) => {
  if (a?.safe === true) return { safe: true, cats: [] };
  if (a?.safe === false) return { safe: false, cats: (Array.isArray(a.cats) ? a.cats : []).map(String).filter((c) => /^S\d{1,2}$/.test(c)) };
  return null;
};
const reasonOf = (model, res, data) => `${model.split('/').pop()}: ${res ? res.status : 'network'}${data?.error?.code ? ' ' + data.error.code : ''}`;

async function llamaGuard(env, model, content, why) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res, data;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify({ model, temperature: 0, max_completion_tokens: 20, messages: [{ role: 'user', content }] }),
        signal: AbortSignal.timeout(15000),
      });
      data = await res.json().catch(() => null);
    } catch { why.push(reasonOf(model)); await sleep(1000); continue; }
    if (res.status === 429 && attempt < 2) { await sleep(Math.min(5000, retryDelay(res, data))); continue; }
    if (!res.ok) { why.push(reasonOf(model, res, data)); return null; }
    const out = String(data?.choices?.[0]?.message?.content || '').trim().toLowerCase();
    if (out.startsWith('safe')) return { safe: true, cats: [] };
    if (out.startsWith('unsafe')) return { safe: false, cats: (out.match(/s\d{1,2}/g) || []).map((c) => c.toUpperCase()) };
    why.push(`${model.split('/').pop()}: odd answer`);
    return null;
  }
  return null;
}

// the text against the policy; halves when it does not fit the per-minute limit
async function readText(env, text, why, depth = 0) {
  try {
    const r = verdict(await groq(env, { system: POLICY, user: text, max: 800, temperature: 0, models: [...POLICY_MODELS, ...siteModels(env)] }));
    if (r) return r;
    why.push('policy: odd answer');
  } catch (e) {
    if (e.code === 'too_long' && text.length > 600 && depth < 5) {
      const cut = Math.max(text.lastIndexOf('\n', text.length / 2), 1);
      const [a, b] = [await readText(env, text.slice(0, cut), why, depth + 1), await readText(env, text.slice(cut), why, depth + 1)];
      if (a && b) return { safe: a.safe && b.safe, cats: [...new Set([...a.cats, ...b.cats])] };
      return null;
    }
    why.push('policy: ' + (e.code || 'error'));
  }
  return null;
}

export async function guard(env, { text, image }) {
  if (!env.GROQ_API_KEY) throw new HttpError(503, 'not_configured');
  const why = [];
  const content = [{ type: 'text', text: String(text || (image ? 'A cover picture for a vocabulary deck.' : '')).slice(0, image ? 2000 : 15000) }];
  if (image) content.push({ type: 'image_url', image_url: { url: image } });
  if (env.GUARD_MODEL) {
    const r = await llamaGuard(env, env.GUARD_MODEL, content, why);
    if (r) return r;
  }
  let r = null;
  if (image) {
    try {
      r = verdict(await groq(env, { system: POLICY, user: content, max: 800, temperature: 0, models: env.GUARD_VISION_MODELS ? String(env.GUARD_VISION_MODELS).split(',').map((x) => x.trim()) : VISION_MODELS }));
      if (!r) why.push('vision: odd answer');
    } catch (e) { why.push('vision: ' + (e.code || 'error')); }
  } else r = await readText(env, content[0].text, why);
  if (r) return r;
  throw new HttpError(503, 'busy', { why: why.join('; ') });
}
