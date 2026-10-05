'use strict';
// The editor and the account commands are separate processes writing one file.
// Every change must survive when they run at the same moment, and a change that
// cannot take the lock must fail without writing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { UserStore } = require('../lib/user-store');

const fast = { N: 1 << 10 };
const lib = path.join(__dirname, '..', 'lib', 'user-store.js');

function worker(file, jobs) {
  const code = `
    const { UserStore } = require(${JSON.stringify(lib)});
    const s = new UserStore(${JSON.stringify(file)}, { hashOpts: { N: 1024 }, lockTimeoutMs: 20000 });
    (async () => {
      for (const j of ${JSON.stringify(jobs)}) {
        if (j.op === 'password') await s.setPassword(j.name, j.password);
        if (j.op === 'disable') s.setDisabled(j.name, true);
        if (j.op === 'sections') s.setSections(j.name, j.sections);
        if (j.op === 'create') await s.create({ name: j.name, role: 'editor', password: j.password, sections: [] });
      }
    })().catch(e => { console.error(e.message); process.exit(1); });`;
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(err || `exit ${c}`))));
  });
}

test('concurrent password resets, disables, section changes and creates from several processes all survive', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-conc-'));
  const file = path.join(dir, 'users.json');
  try {
    const store = new UserStore(file, { hashOpts: fast });
    await store.create({ name: 'root', role: 'admin', password: 'root admin password 1' });
    await store.create({ name: 'root2', role: 'admin', password: 'root2 admin password 1' });
    for (let i = 0; i < 6; i++) await store.create({ name: `ed${i}`, role: 'editor', password: `editor ${i} first password`, sections: ['a'] });
    const jobs = [
      [{ op: 'password', name: 'root', password: 'root reset by proc 0' }, { op: 'create', name: 'new0', password: 'new zero password 1' }],
      [{ op: 'disable', name: 'ed0' }, { op: 'sections', name: 'ed1', sections: ['b', 'c'] }],
      [{ op: 'password', name: 'ed2', password: 'ed2 reset by proc 2' }, { op: 'disable', name: 'ed3' }],
      [{ op: 'sections', name: 'ed4', sections: ['z'] }, { op: 'create', name: 'new1', password: 'new one password 1' }],
      [{ op: 'password', name: 'root2', password: 'root2 reset by proc 4' }, { op: 'sections', name: 'ed5', sections: [] }],
      [{ op: 'password', name: 'ed1', password: 'ed1 reset by proc 5' }, { op: 'create', name: 'new2', password: 'new two password 1' }],
    ];
    // The running store also changes something while the others run.
    const inProcess = (async () => { await store.setPassword('ed0', 'ed0 reset in server'); store.setSections('ed3', ['q']); })();
    await Promise.all([...jobs.map(j => worker(file, j)), inProcess]);

    const fresh = new UserStore(file, { hashOpts: fast });
    assert.ok(await fresh.authenticate('root', 'root reset by proc 0'));
    assert.ok(await fresh.authenticate('root2', 'root2 reset by proc 4'));
    assert.ok(await fresh.authenticate('ed2', 'ed2 reset by proc 2'));
    assert.ok(await fresh.authenticate('ed1', 'ed1 reset by proc 5'));
    assert.equal(await fresh.authenticate('root', 'root admin password 1'), null);
    for (const n of ['new0', 'new1', 'new2']) assert.ok(fresh.get(n), `${n} exists`);
    assert.equal(fresh.get('ed0').disabled, true);
    assert.equal(fresh.get('ed3').disabled, true);
    assert.deepEqual(fresh.get('ed1').sections, ['b', 'c']);
    assert.deepEqual(fresh.get('ed3').sections, ['q']);
    assert.deepEqual(fresh.get('ed4').sections, ['z']);
    assert.deepEqual(fresh.get('ed5').sections, []);
    assert.ok(await fresh.authenticate('ed0', 'ed0 reset in server') === null, 'ed0 is disabled');
    assert.equal(fresh.list().length, 11);
    assert.ok(!fs.existsSync(`${file}.lock`), 'lock released');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a change that cannot take the lock fails and writes nothing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-lock-'));
  const file = path.join(dir, 'users.json');
  try {
    const store = new UserStore(file, { hashOpts: fast, lockTimeoutMs: 300 });
    await store.create({ name: 'ada', role: 'admin', password: 'ada admin password 1' });
    const before = fs.readFileSync(file, 'utf-8');
    fs.writeFileSync(`${file}.lock`, JSON.stringify({ pid: process.pid, at: Date.now() }));
    await assert.rejects(store.setPassword('ada', 'ada changed password 1'), /locked/);
    assert.throws(() => store.setSections('ada', []), /locked/);
    assert.throws(() => store.setDisabled('ada', true), /locked/);
    await assert.rejects(store.create({ name: 'bob', role: 'editor', password: 'bob editor password 1' }), /locked/);
    assert.equal(fs.readFileSync(file, 'utf-8'), before, 'file untouched');
    assert.ok(fs.existsSync(`${file}.lock`), 'a lock held by a live process is left alone');
    fs.unlinkSync(`${file}.lock`);
    await store.setPassword('ada', 'ada changed password 1');
    assert.ok(await store.authenticate('ada', 'ada changed password 1'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a lock left by a process that died is taken over, and a failed change releases the lock', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-stale-'));
  const file = path.join(dir, 'users.json');
  try {
    const store = new UserStore(file, { hashOpts: fast, lockTimeoutMs: 2000, lockStaleMs: 50 });
    await store.create({ name: 'ada', role: 'admin', password: 'ada admin password 1' });
    const dead = spawn(process.execPath, ['-e', '0']);
    await new Promise(r => dead.on('close', r));
    fs.writeFileSync(`${file}.lock`, JSON.stringify({ pid: dead.pid, at: Date.now() - 1000 }));
    store.setSections('ada', []);
    assert.ok(!fs.existsSync(`${file}.lock`));
    assert.throws(() => store.setDisabled('ada', true), /last administrator/);
    assert.ok(!fs.existsSync(`${file}.lock`), 'released after an error');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable user file stops changes instead of being overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-bad-'));
  const file = path.join(dir, 'users.json');
  try {
    const store = new UserStore(file, { hashOpts: fast });
    await store.create({ name: 'ada', role: 'admin', password: 'ada admin password 1' });
    fs.writeFileSync(file, '{ not json');
    await assert.rejects(store.setPassword('ada', 'ada changed password 1'));
    assert.equal(fs.readFileSync(file, 'utf-8'), '{ not json');
    assert.ok(!fs.existsSync(`${file}.lock`));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the reset command fails with an error and leaves the file alone when the lock is held', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-cli-'));
  const file = path.join(dir, 'users.json');
  try {
    const store = new UserStore(file, { hashOpts: fast });
    await store.create({ name: 'ada', role: 'admin', password: 'ada admin password 1' });
    await store.create({ name: 'bea', role: 'admin', password: 'bea admin password 1' });
    store.setDisabled('ada', true);
    const before = fs.readFileSync(file, 'utf-8');
    const script = path.join(__dirname, '..', 'scripts', 'reset-admin.js');
    const env = { ...process.env, MARKSTACK_USERS_FILE: file };
    fs.writeFileSync(`${file}.lock`, JSON.stringify({ pid: process.pid, at: Date.now() }));
    const { spawnSync } = require('child_process');
    const held = spawnSync(process.execPath, [script, '--user', 'ada'], { input: 'ada recovered password 9\n', encoding: 'utf-8', env, timeout: 15000 });
    assert.notEqual(held.status, 0);
    assert.match(held.stderr, /locked/);
    assert.ok(!(held.stdout + held.stderr).includes('recovered password'));
    assert.equal(fs.readFileSync(file, 'utf-8'), before);
    fs.unlinkSync(`${file}.lock`);
    const ok = spawnSync(process.execPath, [script, '--user', 'ada'], { input: 'ada recovered password 9\n', encoding: 'utf-8', env });
    assert.equal(ok.status, 0, ok.stderr);
    const after = new UserStore(file, { hashOpts: fast });
    assert.equal(after.get('ada').disabled, false, 're-enabled in the same change');
    assert.ok(await after.authenticate('ada', 'ada recovered password 9'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
