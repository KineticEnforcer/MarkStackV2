'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { UserStore } = require('../lib/user-store');

const fast = { N: 1 << 10 };
function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-users-'));
  const file = path.join(dir, 'users.json');
  return { dir, file, store: new UserStore(file, { hashOpts: fast }) };
}

test('create, authenticate, and list never expose hashes', async () => {
  const { dir, file, store } = tmpStore();
  try {
    await store.create({ name: 'ada', role: 'admin', password: 'a long admin password' });
    await store.create({ name: 'it-guy', role: 'editor', password: 'another long password', sections: ['it'] });
    assert.deepEqual((await store.authenticate('it-guy', 'another long password')).sections, ['it']);
    assert.equal(await store.authenticate('it-guy', 'wrong password here'), null);
    assert.equal(await store.authenticate('nobody', 'whatever password'), null);
    assert.ok(!JSON.stringify(store.list()).includes('scrypt'));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.ok(!fs.readFileSync(file, 'utf-8').includes('another long password'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('data survives a reload', async () => {
  const { dir, file, store } = tmpStore();
  try {
    await store.create({ name: 'ada', role: 'admin', password: 'a long admin password' });
    const again = new UserStore(file, { hashOpts: fast });
    assert.equal((await again.authenticate('ada', 'a long admin password')).role, 'admin');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('validation: names, roles, sections, password policy, duplicates', async () => {
  const { dir, store } = tmpStore();
  try {
    await assert.rejects(store.create({ name: '../x', role: 'admin', password: 'a long admin password' }));
    await assert.rejects(store.create({ name: 'bob', role: 'root', password: 'a long admin password' }));
    await assert.rejects(store.create({ name: 'bob', role: 'editor', password: 'short' }));
    await assert.rejects(store.create({ name: 'bob', role: 'editor', password: 'a long admin password', sections: ['../etc'] }));
    await store.create({ name: 'bob', role: 'editor', password: 'a long admin password', sections: [] });
    await assert.rejects(store.create({ name: 'bob', role: 'editor', password: 'a long admin password' }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('disabled users cannot sign in; the last admin cannot be disabled', async () => {
  const { dir, store } = tmpStore();
  try {
    await store.create({ name: 'ada', role: 'admin', password: 'a long admin password' });
    await store.create({ name: 'bob', role: 'editor', password: 'a long editor password' });
    assert.throws(() => store.setDisabled('ada', true), /last administrator/);
    store.setDisabled('bob', true);
    assert.equal(await store.authenticate('bob', 'a long editor password'), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('password reset replaces the hash and can require a change at next sign-in', async () => {
  const { dir, store } = tmpStore();
  try {
    await store.create({ name: 'bob', role: 'editor', password: 'a long editor password' });
    await store.setPassword('bob', 'a temporary password', { mustChangePassword: true });
    assert.equal(await store.authenticate('bob', 'a long editor password'), null);
    assert.equal((await store.authenticate('bob', 'a temporary password')).mustChangePassword, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
