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

test('a running store sees changes made by another process and never writes stale data over them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-sync-'));
  const file = path.join(dir, 'users.json');
  try {
    const hashOpts = { N: 1 << 10 };
    const server = new UserStore(file, { hashOpts });
    await server.create({ name: 'root', role: 'admin', password: 'first admin password 1' });
    await server.create({ name: 'ian', role: 'editor', password: 'ian editor password 1', sections: ['it'] });
    // A second process (the recovery command) resets the admin password.
    const cli = new UserStore(file, { hashOpts });
    await cli.setPassword('root', 'recovered admin password 7');
    assert.equal(await server.authenticate('root', 'first admin password 1'), null, 'old password stops working in the running store');
    assert.ok(await server.authenticate('root', 'recovered admin password 7'), 'new password works without a restart');
    // The running store now changes something else; the reset must survive.
    server.setSections('ian', ['it', 'marketing']);
    const fresh = new UserStore(file, { hashOpts });
    assert.ok(await fresh.authenticate('root', 'recovered admin password 7'), 'stale data did not overwrite the reset');
    assert.deepEqual(fresh.get('ian').sections, ['it', 'marketing']);
    // A user added by the other process appears too.
    await cli.create({ name: 'late', role: 'editor', password: 'late editor password 1', sections: [] });
    assert.equal(server.get('late').role, 'editor');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('password, section and disabled changes raise authVersion', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-ver-'));
  try {
    const s = new UserStore(path.join(dir, 'u.json'), { hashOpts: { N: 1 << 10 } });
    await s.create({ name: 'ian', role: 'editor', password: 'ian editor password 1', sections: [] });
    const v0 = s.get('ian').authVersion;
    await s.setPassword('ian', 'ian editor password 2'); const v1 = s.get('ian').authVersion;
    s.setSections('ian', ['it']); const v2 = s.get('ian').authVersion;
    s.setDisabled('ian', true); const v3 = s.get('ian').authVersion;
    assert.ok(v0 < v1 && v1 < v2 && v2 < v3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('successful sign-in time is persisted without changing access version; revocation bumps version', async () => {
  const { dir, file, store } = tmpStore();
  try {
    await store.create({ name: 'qa-temp', role: 'editor', password: 'a long editor password' });
    assert.equal(store.get('qa-temp').lastLoginAt, null);
    store.recordLogin('qa-temp', 0);
    const again = new UserStore(file, { hashOpts: fast });
    assert.ok(Date.parse(again.get('qa-temp').lastLoginAt));
    assert.equal(again.get('qa-temp').authVersion, 0);
    again.revokeSessions('qa-temp');
    assert.equal(store.get('qa-temp').authVersion, 1);
    assert.throws(() => store.recordLogin('qa-temp', 0), /changed during sign-in/);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
