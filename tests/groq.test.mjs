// The Groq client: what it does when the plan's limits refuse a request. No network: fetch is replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groq } from '../src/groq.js';

const env = { GROQ_API_KEY: 'test', GROQ_MODELS: 'm1,m2' };
const prompt = { system: 's', user: 'u', max: 7200 };
const ok = { choices: [{ message: { content: '{"words":[]}' } }] };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function serve(...answers) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
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

test('when the answer would be too small, a request too large is still "too long"', async () => {
  serve(() => reply(413, { error: { message: 'on tokens per minute (TPM): Limit 8000, Requested 14000' } }));
  await assert.rejects(groq(env, prompt), (e) => e.status === 413);
});
