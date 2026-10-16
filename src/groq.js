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

/* Moderation. Llama Guard (on Groq) reads a text and looks at a picture, and says whether they are safe.
   → { safe, cats } — cats: the hazard categories it named (S1…S14: violent crimes, sexual content, weapons of
   mass harm, hate…). When Llama Guard cannot answer (gone, over its limit), the text is read against the same
   categories by a model told the policy (gpt-oss-safeguard, then the site's own models); a picture has no such
   second reader. Throws (503, with what went wrong) when nothing can answer: nothing is let through unchecked. */
const GUARD = 'meta-llama/llama-guard-4-12b';
const POLICY_MODELS = ['openai/gpt-oss-safeguard-20b'];
const POLICY = `You moderate a public library of vocabulary decks for language learners. Decide whether the deck may be listed.
Ordinary vocabulary is fine even when it names sensitive things: body parts, illnesses, medicine and pills, alcohol, police, crime, war, weapons, death, swear words in a lesson about them.
It is NOT fine when the deck as a whole is sexually explicit or pornographic (S12), sexualises minors (S4), promotes or explains buying, making or using illegal drugs (S2), explains making weapons or explosives (S9), incites violence or terrorism (S1), is hateful or harassing towards a group or a person (S10), encourages self-harm (S11), or shares private data about a real person (S7).
Answer only JSON: {"safe": true} or {"safe": false, "cats": ["S12"]}.`;

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

export async function guard(env, { text, image }) {
  if (!env.GROQ_API_KEY) throw new HttpError(503, 'not_configured');
  const why = [];
  const model = env.GUARD_MODEL || GUARD;
  if (image) {
    const r = await llamaGuard(env, model, [{ type: 'text', text: String(text || 'A cover picture for a vocabulary deck.').slice(0, 2000) }, { type: 'image_url', image_url: { url: image } }], why);
    if (r) return r;
    throw new HttpError(503, 'busy', { why: why.join('; ') });
  }
  const r = await llamaGuard(env, model, [{ type: 'text', text: String(text || '').slice(0, 15000) }], why);
  if (r) return r;
  try {
    const a = await groq(env, { system: POLICY, user: String(text || '').slice(0, 15000), max: 1500, temperature: 0, models: [...POLICY_MODELS, ...siteModels(env)] });
    if (a?.safe === true) return { safe: true, cats: [] };
    if (a?.safe === false) return { safe: false, cats: (Array.isArray(a.cats) ? a.cats : []).map(String).filter((c) => /^S\d{1,2}$/.test(c)) };
    why.push('policy: odd answer');
  } catch (e) { why.push('policy: ' + (e.code || 'error')); }
  throw new HttpError(503, 'busy', { why: why.join('; ') });
}
