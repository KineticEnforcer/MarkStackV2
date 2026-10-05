'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { UserStore } = require('../lib/user-store');

const script = path.join(__dirname, '..', 'scripts', 'create-admin.js');
function run(args, input, file) {
  return spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf-8', env: { ...process.env, MARKSTACK_USERS_FILE: file } });
}

test('creates an administrator from piped input; the password is not in output or argv', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, '.markstack', 'users.json');
  try {
    const pw = 'piped admin password 99';
    const r = run(['--user', 'Root'], pw + '\n', file);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(pw));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    const user = await new UserStore(file).authenticate('root', pw);
    assert.equal(user.role, 'admin');
    assert.ok(!fs.readFileSync(file, 'utf-8').includes(pw));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejects a weak password, a duplicate user and a missing --user', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, 'users.json');
  try {
    assert.notEqual(run(['--user', 'root'], 'short\n', file).status, 0);
    assert.equal(run(['--user', 'root'], 'a long enough password\n', file).status, 0);
    assert.notEqual(run(['--user', 'root'], 'a long enough password\n', file).status, 0);
    const noUser = run([], 'a long enough password\n', file);
    assert.equal(noUser.status, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a password given as an argument is not accepted as one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, 'users.json');
  try {
    const r = run(['--user', 'root', '--password', 'argv password 12345'], '', file);
    assert.notEqual(r.status, 0);
    assert.ok(!fs.existsSync(file));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

const resetScript = path.join(__dirname, '..', 'scripts', 'reset-admin.js');
function reset(args, input, file) {
  return spawnSync(process.execPath, [resetScript, ...args], { input, encoding: 'utf-8', env: { ...process.env, MARKSTACK_USERS_FILE: file } });
}

test('reset-admin sets a new password for an administrator, enables the account, and prints no password', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, 'users.json');
  try {
    assert.equal(run(['--user', 'root'], 'first admin password 1\n', file).status, 0);
    const store = new UserStore(file);
    await store.create({ name: 'second', role: 'admin', password: 'second admin password 1' });
    store.setDisabled('root', true);
    const pw = 'recovered admin password 7';
    const r = reset(['--user', 'root'], pw + '\n', file);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(pw));
    const fresh = new UserStore(file);
    assert.equal((await fresh.authenticate('root', pw)).role, 'admin');
    assert.equal(await fresh.authenticate('root', 'first admin password 1'), null);
    assert.ok(!fs.readFileSync(file, 'utf-8').includes(pw));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('reset-admin refuses editors, unknown users, weak passwords and a password argument', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, 'users.json');
  try {
    assert.equal(run(['--user', 'root'], 'first admin password 1\n', file).status, 0);
    await new UserStore(file).create({ name: 'ed', role: 'editor', password: 'editor password 123', sections: [] });
    assert.notEqual(reset(['--user', 'ed'], 'a long enough password\n', file).status, 0);
    assert.notEqual(reset(['--user', 'nobody'], 'a long enough password\n', file).status, 0);
    assert.notEqual(reset(['--user', 'root'], 'short\n', file).status, 0);
    assert.equal(reset([], 'a long enough password\n', file).status, 2);
    assert.notEqual(reset(['--user', 'root', '--password', 'argv password 12345'], '', file).status, 0);
    assert.equal(await new UserStore(file).authenticate('ed', 'a long enough password'), null);
    assert.ok((await new UserStore(file).authenticate('root', 'first admin password 1')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
