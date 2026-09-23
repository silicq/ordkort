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

export async function groq(env, { system, user, max = 2500, temperature = 0.35, effort = 'low' }) {
  if (!env.GROQ_API_KEY) throw new HttpError(503, 'not_configured');
  const models = (env.GROQ_MODELS ? String(env.GROQ_MODELS).split(',').map((s) => s.trim()) : DEFAULT_MODELS).filter(Boolean);
  let waited = 0;

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
      model, temperature, max_completion_tokens: max,
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
