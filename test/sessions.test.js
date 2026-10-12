'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionStore } = require('../lib/sessions');

function make() {
  const clock = { t: 1000 };
  const s = new SessionStore({ idleMs: 100, maxMs: 500, now: () => clock.t });
  return { s, clock };
}

test('a token resolves to its user and CSRF token; unknown tokens do not', () => {
  const { s } = make();
  const tok = s.create('ada');
  const got = s.get(tok);
  assert.equal(got.user, 'ada');
  assert.ok(got.csrf.length >= 20);
  assert.equal(s.get('x'.repeat(43)), null);
  assert.equal(s.get(undefined), null);
});

test('idle timeout ends a session, activity extends it, absolute limit still applies', () => {
  const { s, clock } = make();
  const tok = s.create('ada');
  clock.t += 90; assert.ok(s.get(tok));
  clock.t += 90; assert.ok(s.get(tok));
  clock.t += 90; assert.ok(s.get(tok));
  clock.t += 90; assert.ok(s.get(tok));
  clock.t += 90; assert.ok(s.get(tok));
  clock.t += 90; assert.equal(s.get(tok), null);
});

test('idle expiry', () => {
  const { s, clock } = make();
  const tok = s.create('ada');
  clock.t += 101;
  assert.equal(s.get(tok), null);
});

test('CSRF: only the session own token passes', () => {
  const { s } = make();
  const a = s.create('ada'); const b = s.create('bob');
  assert.equal(s.checkCsrf(a, s.get(a).csrf), true);
  assert.equal(s.checkCsrf(a, s.get(b).csrf), false);
  assert.equal(s.checkCsrf(a, undefined), false);
  assert.equal(s.checkCsrf(a, ''), false);
});

test('destroy and destroyUser end sessions', () => {
  const { s } = make();
  const a1 = s.create('ada'); const a2 = s.create('ada'); const b = s.create('bob');
  s.destroy(a1);
  assert.equal(s.get(a1), null);
  assert.equal(s.destroyUser('ada'), 1);
  assert.equal(s.get(a2), null);
  assert.ok(s.get(b));
});

test('tokens are not stored in clear', () => {
  const { s } = make();
  const tok = s.create('ada');
  assert.ok(![...s.byHash.keys()].includes(tok));
});

test('session summaries omit secrets, do not refresh idle time and filter obsolete access versions', () => {
  let now = 100000;
  const s = new SessionStore({ idleMs: 1000, maxMs: 5000, now: () => now });
  const token = s.create('qa-temp', 1); s.create('qa-temp', 0); s.create('other', 1);
  now += 900;
  const summary = s.summary('qa-temp', 1);
  assert.equal(summary.length, 1);
  assert.deepEqual(Object.keys(summary[0]).sort(), ['createdAt', 'lastActiveAt']);
  assert.ok(!JSON.stringify(summary).includes(token));
  now += 101;
  assert.equal(s.summary('qa-temp', 1).length, 0);
});
