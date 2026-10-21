// The AI client: what it does when a plan's limits refuse a request, and how it moves between providers. No network:
// fetch is replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groq } from '../src/ai/groq.js';

const env = { GROQ_API_KEY: 'test', GROQ_MODELS: 'm1,m2' };
const prompt = { system: 's', user: 'u', max: 7200 };
const ok = { choices: [{ message: { content: '{"words":[]}' } }] };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function serve(...answers) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ ...JSON.parse(init.body), url, auth: init.headers.Authorization });
    return answers.shift()();
  };
  return sent;
}

test('a request too large for the per-minute limit is sent again with a smaller limit for the answer', async () => {
  const sent = serve(
    () => reply(413, { error: { code: 'rate_limit_exceeded', message: 'Request too large for model `m1` in organization `o` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8526, please reduce your message size and try again.' } }),
    () => reply(200, ok),
  );
  assert.deepEqual(await groq(env, prompt), { words: [] });
  assert.equal(sent[0].max_completion_tokens, 7200);
  assert.equal(sent[1].max_completion_tokens, 7200 - 526 - 200);
});

test('when the answer would be too small, a request too large for every model is "too long"', async () => {
  const big = () => reply(413, { error: { message: 'on tokens per minute (TPM): Limit 8000, Requested 14000' } });
  serve(big, big);
  await assert.rejects(groq(env, prompt), (e) => e.status === 413);
});

test('a request too long for one provider goes to the next', async () => {
  const sent = serve(
    () => reply(400, { error: { code: 'context_length_exceeded', message: 'too long' } }),
    () => reply(200, ok),
  );
  const e = { GROQ_API_KEY: 'g', CEREBRAS_API_KEY: 'c', AI_MODELS: 'long1,cerebras:long2' };
  assert.deepEqual(await groq(e, prompt), { words: [] });
  assert.equal(sent[1].model, 'long2');
});

test('a model at its daily limit waits the time it was told, and the next provider answers with its own key', async () => {
  const sent = serve(
    () => reply(429, { error: { code: 'rate_limit_exceeded', message: 'Rate limit reached on tokens per day (TPD): Limit 200000, Used 199500, Requested 1500. Please try again in 7m12.5s.' } }),
    () => reply(200, ok),
    () => reply(200, ok),
  );
  const e = { GROQ_API_KEY: 'g', CEREBRAS_API_KEY: 'c', AI_MODELS: 'day1,cerebras:day2,deepinfra:day3' };
  assert.deepEqual(await groq(e, prompt), { words: [] });
  assert.match(sent[1].url, /api\.cerebras\.ai/);
  assert.equal(sent[1].auth, 'Bearer c');
  // still blocked on the next request; deepinfra has no key, so it is never asked
  await groq(e, prompt);
  assert.equal(sent.length, 3);
  assert.equal(sent[2].model, 'day2');
});

test('a provider whose credit has run out (402) is skipped for an hour, not asked again every few seconds', async () => {
  const sent = serve(
    () => reply(402, { error: { message: 'Payment required: the account has no credit left' } }),
    () => reply(200, ok),
    () => reply(200, ok),
  );
  const e = { GROQ_API_KEY: 'g', CEREBRAS_API_KEY: 'c', AI_MODELS: 'cerebras:spent1,next1' };
  assert.deepEqual(await groq(e, prompt), { words: [] });
  assert.equal(sent[1].model, 'next1');
  // a minute later: past the few seconds an ordinary error waits, the spent provider is still passed over
  const now = Date.now;
  Date.now = () => now() + 6e4;
  try { await groq(e, prompt); } finally { Date.now = now; }
  assert.deepEqual(sent.map((s) => s.model), ['spent1', 'next1', 'next1']);
});

test('the paid fallback is asked only while its daily tokens last, and its tokens are counted', async () => {
  const counted = [];
  const db = (used) => ({
    prepare: () => ({ bind: (...a) => ({ first: async () => { if (a.length > 1) counted.push(a[1]); return { n: used }; } }) }),
  });
  serve(() => { throw new Error('the paid model must not be asked'); });
  const e = { DEEPINFRA_API_KEY: 'd', AI_MODELS: 'deepinfra:paid1', PAID_DAILY_TOKENS: '1000' };
  await assert.rejects(groq({ ...e, DB: db(1000) }, prompt), (x) => x.status === 503);

  serve(() => reply(200, { ...ok, usage: { total_tokens: 640 } }));
  assert.deepEqual(await groq({ ...e, AI_MODELS: 'deepinfra:paid2', DB: db(10) }, prompt), { words: [] });
  assert.deepEqual(counted, [640]);
});

test('with no key at all the AI is "not configured"', async () => {
  await assert.rejects(groq({}, prompt), (e) => e.status === 503 && e.code === 'not_configured');
});
