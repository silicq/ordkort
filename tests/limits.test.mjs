// Who is one person for the limits (src/limits.js): an IPv4 address, or an IPv6 /64 network however it is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { network, clientKey } from '../src/limits.js';

const key = (ip) => clientKey(new Request('https://ordkort.com/api/x', { headers: { 'CF-Connecting-IP': ip } }), { IP_SALT: 'test' });

test('an IPv6 address counts by its /64, whatever the way it is written', () => {
  for (const ip of ['2600:3c00::f03c:91ff:fe12:3456', '2600:3c00::abcd', '2600:3C00:0:0:1:2:3:4', '2600:3c00:0000:0000::1', '2600:3c00::'])
    assert.equal(network(ip), '2600:3c00:0:0', ip);
  assert.equal(network('::1'), '0:0:0:0');
  assert.equal(network('fe80::1%eth0'), 'fe80:0:0:0');
  assert.notEqual(network('2600:3c00:0:1::1'), network('2600:3c00:0:2::1'), 'another /64 is another person');
  // as Cloudflare writes it, with '::' past the fourth group: the same text as the first four groups, as it always was
  assert.equal(network('2001:db8:0:12:1:2:3:4'), '2001:db8:0:12');
  assert.equal(network('2001:db8:ab:12::1'), '2001:db8:ab:12');
});

test('an IPv4 address counts as itself, also when it comes as IPv6', () => {
  assert.equal(network('203.0.113.7'), '203.0.113.7');
  assert.equal(network('::ffff:203.0.113.7'), '203.0.113.7');
});

test('changing the device part of an IPv6 address does not give a new fingerprint', async () => {
  assert.equal(await key('2600:3c00::f03c:91ff:fe12:3456'), await key('2600:3c00::abcd:1:2:3'));
  assert.notEqual(await key('2600:3c00:0:1::1'), await key('2600:3c00:0:2::1'));
});
