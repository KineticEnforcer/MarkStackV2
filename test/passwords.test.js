'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, checkPasswordPolicy } = require('../lib/passwords');

const fast = { N: 1 << 10 };

test('a correct password verifies and a wrong one does not', async () => {
  const h = await hashPassword('correct horse battery', fast);
  assert.ok(h.startsWith('scrypt$1024$8$1$'));
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('correct horse batterz', h), false);
});

test('each hash has its own salt', async () => {
  const a = await hashPassword('same password here', fast);
  const b = await hashPassword('same password here', fast);
  assert.notEqual(a, b);
});

test('the hash string never contains the password', async () => {
  const h = await hashPassword('very secret phrase 1', fast);
  assert.ok(!h.includes('very secret'));
});

test('malformed or tampered hashes are rejected, not thrown', async () => {
  assert.equal(await verifyPassword('x', 'nope'), false);
  assert.equal(await verifyPassword('x', 'scrypt$1024$8$1$AAAA'), false);
  assert.equal(await verifyPassword('x', 'scrypt$4294967296$8$1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), false);
  assert.equal(await verifyPassword(undefined, 'scrypt$1024$8$1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), false);
});

test('policy: minimum length, common list, no composition rules', () => {
  assert.ok(checkPasswordPolicy('short'));
  assert.ok(checkPasswordPolicy('password1234'));
  assert.equal(checkPasswordPolicy('all lowercase words fine'), null);
});
