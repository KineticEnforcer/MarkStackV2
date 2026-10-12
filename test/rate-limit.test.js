'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FailureLimiter } = require('../lib/rate-limit');

test('blocks after the maximum failures, then lets the key back in', () => {
  const c = { t: 0 };
  const l = new FailureLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 5000, now: () => c.t });
  l.fail('a'); l.fail('a');
  assert.equal(l.isBlocked('a'), false);
  l.fail('a');
  assert.equal(l.isBlocked('a'), true);
  assert.equal(l.isBlocked('b'), false);
  c.t = 4999; assert.equal(l.isBlocked('a'), true);
  c.t = 5001; assert.equal(l.isBlocked('a'), false);
});

test('old failures fall out of the window and clear resets', () => {
  const c = { t: 0 };
  const l = new FailureLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 5000, now: () => c.t });
  l.fail('a'); l.fail('a');
  c.t = 2000; l.fail('a');
  assert.equal(l.isBlocked('a'), false);
  l.fail('a'); l.fail('a');
  assert.equal(l.isBlocked('a'), true);
  l.clear('a');
  assert.equal(l.isBlocked('a'), false);
});
test('rate-limit summary counts groups without revealing keys and expires old entries',()=>{let now=0;const f=new FailureLimiter({maxFailures:2,windowMs:100,blockMs:200,now:()=>now});f.fail('private-address');f.fail('private-address');assert.equal(f.summary().blocked,1);assert.ok(!JSON.stringify(f.summary()).includes('private-address'));now=201;assert.equal(f.summary().tracked,0);});
