'use strict';
// End-to-end checks of sign-in, sessions, CSRF, section limits and user management over HTTP.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const editor = require('../editor-server.js');
const { server, CONFIG } = editor;
const { UserStore } = require('../lib/user-store');
const { SessionStore } = require('../lib/sessions');
const { FailureLimiter } = require('../lib/rate-limit');

let users;
let tmp, port;
const logs = [];
const realLog = console.log;

function request(method, urlPath, { body, cookie, csrf, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const h = { Host: `127.0.0.1:${port}`, ...headers };
    if (data !== null) h['Content-Type'] = 'application/json';
    if (cookie) h.Cookie = cookie;
    if (csrf) h['X-CSRF-Token'] = csrf;
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(out); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, body: out, json });
      });
    });
    req.on('error', reject);
    if (data !== null) req.write(data);
    req.end();
  });
}

async function login(name, password) {
  const r = await request('POST', '/api/login', { body: { name, password } });
  if (r.status !== 200) return { r };
  const cookie = r.headers['set-cookie'][0].split(';')[0];
  return { r, cookie, csrf: r.json.csrf };
}

const ADMIN_PW = 'an admin password here';
const EDITOR_PW = 'an editor password here';

test.before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-auth-'));
  CONFIG.contentDir = path.join(tmp, 'content');
  for (const s of ['it', 'marketing']) {
    fs.mkdirSync(path.join(CONFIG.contentDir, s), { recursive: true });
    fs.writeFileSync(path.join(CONFIG.contentDir, s, '_index.md'), `---\ntitle: ${s}\n---\n`);
    fs.writeFileSync(path.join(CONFIG.contentDir, s, 'page.md'), `# ${s} page\n`);
  }
  users = new UserStore(path.join(tmp, 'users.json'), { hashOpts: { N: 1 << 10 } });
  await users.create({ name: 'ada', role: 'admin', password: ADMIN_PW });
  await users.create({ name: 'ian', role: 'editor', password: EDITOR_PW, sections: ['it'] });
  editor.initAuth({
    users,
    sessions: new SessionStore({ idleMs: 3600e3, maxMs: 7200e3 }),
    byAccount: new FailureLimiter({ maxFailures: 3 }),
    byAddress: new FailureLimiter({ maxFailures: 100 })
  });
  console.log = (...a) => { logs.push(a.join(' ')); };
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  CONFIG.port = port;
});

test.after(() => { console.log = realLog; server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('every API route answers 401 without a session', async () => {
  const routes = [
    ['GET', '/api/tree'], ['GET', '/api/file?path=it/page.md'], ['POST', '/api/file'], ['POST', '/api/create-folder'],
    ['POST', '/api/create-file'], ['POST', '/api/rename'], ['DELETE', '/api/delete?path=it/page.md'],
    ['GET', '/api/me'], ['GET', '/api/users'], ['POST', '/api/users'], ['POST', '/api/logout']
  ];
  for (const [m, u] of routes) {
    const r = await request(m, u, m === 'POST' ? { body: {} } : {});
    assert.equal(r.status, 401, `${m} ${u}`);
  }
});

test('the editor page redirects to the login page without a session; the login page is public', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/login');
  const l = await request('GET', '/login');
  assert.equal(l.status, 200);
  assert.match(l.headers['content-security-policy'], /script-src 'nonce-/);
});

test('login: cookie flags, same message for wrong user and wrong password', async () => {
  const ok = await login('ada', ADMIN_PW);
  assert.equal(ok.r.status, 200);
  const flags = ok.r.headers['set-cookie'][0];
  assert.match(flags, /HttpOnly/);
  assert.match(flags, /SameSite=Strict/);
  assert.ok(!/Secure/.test(flags), 'Secure only when configured');
  const wrongPw = await request('POST', '/api/login', { body: { name: 'ada', password: 'not the password' } });
  const noUser = await request('POST', '/api/login', { body: { name: 'nobody', password: 'not the password' } });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(wrongPw.json, noUser.json);
});

test('Secure cookie flag follows the setting', async () => {
  CONFIG.cookieSecure = true;
  try {
    const ok = await login('ada', ADMIN_PW);
    assert.match(ok.r.headers['set-cookie'][0], /; Secure/);
  } finally { CONFIG.cookieSecure = false; }
});

test('changes need the CSRF token', async () => {
  const s = await login('ada', ADMIN_PW);
  const noToken = await request('POST', '/api/file', { cookie: s.cookie, body: { path: 'it/page.md', content: 'x' } });
  assert.equal(noToken.status, 403);
  const bad = await request('POST', '/api/file', { cookie: s.cookie, csrf: 'wrong', body: { path: 'it/page.md', content: 'x' } });
  assert.equal(bad.status, 403);
  const good = await request('POST', '/api/file', { cookie: s.cookie, csrf: s.csrf, body: { path: 'it/page.md', content: '# it page\n' } });
  assert.equal(good.status, 200);
});

test('repeated failures pause sign-in for that account from that address only', async () => {
  CONFIG.trustedProxies = ['127.0.0.1'];
  try {
    const from = ip => ({ headers: { 'X-Forwarded-For': ip } });
    const attempt = (ip, name, pw) => request('POST', '/api/login', { body: { name, password: pw }, ...from(ip) });
    for (let i = 0; i < 3; i++) await attempt('203.0.113.9', 'ada', 'wrong wrong wrong');
    assert.equal((await attempt('203.0.113.9', 'ada', ADMIN_PW)).status, 429, 'attacker address is paused, even with the right password');
    assert.equal((await attempt('198.51.100.7', 'ada', ADMIN_PW)).status, 200, 'the real user from another address still gets in');
  } finally { CONFIG.trustedProxies = []; }
});

test('a client cannot pick its own address through X-Forwarded-For when no proxy is configured', async () => {
  for (let i = 0; i < 3; i++) {
    await request('POST', '/api/login', { body: { name: 'ghost', password: 'wrong wrong wrong' }, headers: { 'X-Forwarded-For': `10.0.0.${i}` } });
  }
  const r = await request('POST', '/api/login', { body: { name: 'ghost', password: EDITOR_PW }, headers: { 'X-Forwarded-For': '10.9.9.9' } });
  assert.equal(r.status, 429, 'spoofed header ignored, same real address');
});

test('with one proxy configured, the rightmost entry is used, so a spoofed left entry does not help', async () => {
  CONFIG.trustedProxies = ['127.0.0.1'];
  try {
    const attempt = (xff, pw) => request('POST', '/api/login', { body: { name: 'mia2', password: pw }, headers: { 'X-Forwarded-For': xff } });
    for (let i = 0; i < 3; i++) await attempt(`1.1.1.${i}, 192.0.2.50`, 'wrong wrong wrong');
    assert.equal((await attempt('9.9.9.9, 192.0.2.50', 'wrong wrong wrong')).status, 429);
  } finally { CONFIG.trustedProxies = []; }
});

test('X-Forwarded-For from a peer that is not a trusted proxy is ignored, even when proxies are configured', async () => {
  CONFIG.trustedProxies = ['10.255.0.1'];
  try {
    for (let i = 0; i < 3; i++) await request('POST', '/api/login', { body: { name: 'ghost3', password: 'wrong wrong wrong' }, headers: { 'X-Forwarded-For': `10.1.0.${i}` } });
    const r = await request('POST', '/api/login', { body: { name: 'ghost3', password: 'wrong wrong wrong' }, headers: { 'X-Forwarded-For': '10.1.9.9' } });
    assert.equal(r.status, 429, 'all attempts counted against the real peer address');
  } finally { CONFIG.trustedProxies = []; }
});

test('with a chain of trusted proxies, the first untrusted address from the right is the client', async () => {
  CONFIG.trustedProxies = ['127.0.0.1', '192.0.2.50'];
  try {
    const attempt = xff => request('POST', '/api/login', { body: { name: 'ghost4', password: 'wrong wrong wrong' }, headers: { 'X-Forwarded-For': xff } });
    for (let i = 0; i < 3; i++) await attempt(`1.2.3.${i}, 9.9.9.9, 192.0.2.50`);
    assert.equal((await attempt('7.7.7.7, 9.9.9.9, 192.0.2.50')).status, 429, 'left-hand entries cannot change the client address');
    assert.equal((await attempt('8.8.8.8')).status, 401, 'a different real client is not paused');
  } finally { CONFIG.trustedProxies = []; }
});

test('guessing spread over many addresses pauses new addresses for that account, not the addresses it normally uses', async () => {
  await users.create({ name: 'dora', role: 'editor', password: 'dora long password 1', sections: ['it'] });
  CONFIG.trustedProxies = ['127.0.0.1'];
  try {
    const attempt = (ip, pw) => request('POST', '/api/login', { body: { name: 'dora', password: pw }, headers: { 'X-Forwarded-For': ip } });
    assert.equal((await attempt('198.51.100.20', 'dora long password 1')).status, 200, 'normal sign-in from her usual address');
    for (let i = 0; i < 20; i++) assert.equal((await attempt(`203.0.113.${i + 1}`, 'wrong wrong wrong')).status, 401);
    assert.equal((await attempt('203.0.113.99', 'dora long password 1')).status, 429, 'a never-used address is paused');
    assert.equal((await attempt('198.51.100.20', 'dora long password 1')).status, 200, 'her usual address still works');
  } finally { CONFIG.trustedProxies = []; }
});

test('an editor sees and reaches only the assigned section, enforced on the server', async () => {
  const s = await login('ian', EDITOR_PW);
  const tree = await request('GET', '/api/tree', { cookie: s.cookie });
  assert.deepEqual(tree.json.map(n => n.name), ['it']);
  assert.equal((await request('GET', '/api/file?path=it/page.md', { cookie: s.cookie })).status, 200);
  assert.equal((await request('GET', '/api/file?path=marketing/page.md', { cookie: s.cookie })).status, 404);
  const w = (p, c) => request('POST', '/api/file', { cookie: s.cookie, csrf: s.csrf, body: { path: p, content: c } });
  assert.equal((await w('it/new.md', 'ok')).status, 200);
  assert.equal((await w('marketing/page.md', 'hacked')).status, 404);
  assert.equal(fs.readFileSync(path.join(CONFIG.contentDir, 'marketing', 'page.md'), 'utf-8'), '# marketing page\n');
  const topFolder = await request('POST', '/api/create-folder', { cookie: s.cookie, csrf: s.csrf, body: { name: 'newsection' } });
  assert.equal(topFolder.status, 404);
  assert.ok(!fs.existsSync(path.join(CONFIG.contentDir, 'newsection')));
  const renameRoot = await request('POST', '/api/rename', { cookie: s.cookie, csrf: s.csrf, body: { oldPath: 'it', newName: 'it2', isFolder: true } });
  assert.equal(renameRoot.status, 403);
  const del = await request('DELETE', '/api/delete?path=marketing/page.md', { cookie: s.cookie, csrf: s.csrf });
  assert.equal(del.status, 404);
  assert.ok(fs.existsSync(path.join(CONFIG.contentDir, 'marketing', 'page.md')));
  const delRoot = await request('DELETE', '/api/delete?path=it', { cookie: s.cookie, csrf: s.csrf });
  assert.equal(delRoot.status, 403);
  assert.equal((await request('GET', '/api/users', { cookie: s.cookie })).status, 403);
  assert.equal((await request('GET', '/admin/users', { cookie: s.cookie })).status, 403);
});

test('new folders and files can be nested at any depth, inside the user\'s own sections only', async () => {
  const post = (who, route, body) => request('POST', route, { cookie: who.cookie, csrf: who.csrf, body });
  const ian = await login('ian', EDITOR_PW);
  const ada = await login('ada', ADMIN_PW);
  // an editor nests three levels deep inside the assigned section
  assert.equal((await post(ian, '/api/create-folder', { parentPath: 'it', name: 'guides' })).json.path, 'it/guides');
  assert.equal((await post(ian, '/api/create-folder', { parentPath: 'it/guides', name: 'setup' })).json.path, 'it/guides/setup');
  const f = await post(ian, '/api/create-file', { parentPath: 'it/guides/setup', name: 'linux' });
  assert.equal(f.json.path, 'it/guides/setup/linux.md');
  assert.ok(fs.existsSync(path.join(CONFIG.contentDir, 'it', 'guides', 'setup', '_index.md')));
  assert.ok(fs.existsSync(path.join(CONFIG.contentDir, 'it', 'guides', 'setup', 'linux.md')));
  // the tree shows the nested folders to the editor
  const tree = await request('GET', '/api/tree', { cookie: ian.cookie });
  const guides = tree.json[0].children.find(n => n.name === 'guides');
  assert.equal(guides.children.find(n => n.name === 'setup').type, 'folder');
  // an editor cannot place anything in another section or at the top level
  assert.equal((await post(ian, '/api/create-folder', { parentPath: 'marketing', name: 'x' })).status, 404);
  assert.equal((await post(ian, '/api/create-file', { parentPath: 'marketing', name: 'x' })).status, 404);
  assert.equal((await post(ian, '/api/create-file', { parentPath: '', name: 'top' })).status, 404);
  assert.ok(!fs.existsSync(path.join(CONFIG.contentDir, 'marketing', 'x')));
  // climbing out with .. is refused
  assert.notEqual((await post(ian, '/api/create-folder', { parentPath: 'it/../marketing', name: 'x' })).status, 200);
  assert.ok(!fs.existsSync(path.join(CONFIG.contentDir, 'marketing', 'x')));
  // a parent that does not exist is refused instead of being created silently
  const missing = await post(ian, '/api/create-file', { parentPath: 'it/not-there', name: 'x' });
  assert.equal(missing.status, 404);
  assert.ok(!fs.existsSync(path.join(CONFIG.contentDir, 'it', 'not-there')));
  const missingAdmin = await post(ada, '/api/create-folder', { parentPath: 'nope/deeper', name: 'x' });
  assert.equal(missingAdmin.status, 404);
  assert.ok(!fs.existsSync(path.join(CONFIG.contentDir, 'nope')));
  // an administrator may create at the top level and in any section
  assert.equal((await post(ada, '/api/create-folder', { parentPath: '', name: 'ops' })).status, 200);
  assert.equal((await post(ada, '/api/create-file', { parentPath: 'marketing', name: 'y' })).status, 200);
  for (const p of ['ops', 'it/guides', 'marketing/y.md']) fs.rmSync(path.join(CONFIG.contentDir, p), { recursive: true, force: true });
});

test('with the user file locked by another process, a password change fails closed and nothing changes', async () => {
  await users.create({ name: 'lena', role: 'editor', password: 'lena first password 1', sections: ['it'] });
  const s = await login('lena', 'lena first password 1');
  const file = path.join(tmp, 'users.json');
  const before = fs.readFileSync(file, 'utf-8');
  users.lockTimeoutMs = 200;
  fs.writeFileSync(`${file}.lock`, JSON.stringify({ pid: process.pid, at: Date.now() }));
  try {
    const r = await request('POST', '/api/change-password', { cookie: s.cookie, csrf: s.csrf, body: { current: 'lena first password 1', password: 'lena second password 2' } });
    assert.equal(r.status, 500);
    assert.equal(fs.readFileSync(file, 'utf-8'), before);
  } finally { fs.unlinkSync(`${file}.lock`); users.lockTimeoutMs = 5000; }
  assert.equal((await login('lena', 'lena first password 1')).r.status, 200);
  assert.equal((await login('lena', 'lena second password 2')).r.status, 401);
});

test('admin manages users; reset gives a one-time password, ends sessions and forces a change', async () => {
  const admin = await login('ada', ADMIN_PW);
  const ed = await login('console-editor', EDITOR_PW);
  const list = await request('GET', '/api/users', { cookie: admin.cookie });
  assert.deepEqual(list.json.sections.sort(), ['it', 'marketing']);
  assert.ok(!JSON.stringify(list.json).includes('scrypt'));

  const reset = await request('POST', '/api/users/reset-password', { cookie: admin.cookie, csrf: admin.csrf, body: { name: 'ian' } });
  assert.equal(reset.status, 200);
  const temp = reset.json.temporaryPassword;
  assert.ok(temp.length >= 20);
  assert.equal((await request('GET', '/api/tree', { cookie: ed.cookie })).status, 401, 'old session ended');
  assert.ok(!logs.join('\n').includes(temp), 'temporary password is never logged');

  const t = await login('ian', temp);
  assert.equal(t.r.json.user.mustChangePassword, true);
  assert.equal((await request('GET', '/api/tree', { cookie: t.cookie })).status, 403, 'blocked until changed');
  const changed = await request('POST', '/api/change-password', { cookie: t.cookie, csrf: t.csrf, body: { current: temp, password: 'my own new password 1' } });
  assert.equal(changed.status, 200);
  const cookie2 = changed.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request('GET', '/api/tree', { cookie: cookie2 })).status, 200);
  assert.equal((await request('GET', '/api/tree', { cookie: t.cookie })).status, 401);
  assert.ok(!logs.join('\n').includes('my own new password'));
});

test('a password reset made by the server command ends open sessions and the new password works without a restart', async () => {
  await users.create({ name: 'rita', role: 'admin', password: 'rita admin password 1' });
  const before = await login('rita', 'rita admin password 1');
  assert.equal((await request('GET', '/api/tree', { cookie: before.cookie })).status, 200);
  const script = path.join(__dirname, '..', 'scripts', 'reset-admin.js');
  const r = require('child_process').spawnSync(process.execPath, [script, '--user', 'rita'], {
    input: 'rita recovered password 9\n', encoding: 'utf-8', env: { ...process.env, MARKSTACK_USERS_FILE: path.join(tmp, 'users.json') }
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await request('GET', '/api/tree', { cookie: before.cookie })).status, 401, 'the old session ended');
  assert.equal((await login('rita', 'rita admin password 1')).r.status, 401);
  assert.equal((await login('rita', 'rita recovered password 9')).r.status, 200);
});

test('admin cannot disable self; disabling ends sessions; section change ends sessions', async () => {
  const admin = await login('ada', ADMIN_PW);
  const self = await request('POST', '/api/users/disable', { cookie: admin.cookie, csrf: admin.csrf, body: { name: 'ada', disabled: true } });
  assert.equal(self.status, 400);
  const created = await request('POST', '/api/users', { cookie: admin.cookie, csrf: admin.csrf, body: { name: 'mia', role: 'editor', password: 'mia long password 12', sections: ['marketing'] } });
  assert.equal(created.status, 200);
  const mia = await login('mia', 'mia long password 12');
  assert.equal((await request('GET', '/api/file?path=marketing/page.md', { cookie: mia.cookie })).status, 200);
  await request('POST', '/api/users/sections', { cookie: admin.cookie, csrf: admin.csrf, body: { name: 'mia', sections: [] } });
  assert.equal((await request('GET', '/api/tree', { cookie: mia.cookie })).status, 401);
  const mia2 = await login('mia', 'mia long password 12');
  assert.deepEqual((await request('GET', '/api/tree', { cookie: mia2.cookie })).json, []);
  await request('POST', '/api/users/disable', { cookie: admin.cookie, csrf: admin.csrf, body: { name: 'mia', disabled: true } });
  assert.equal((await request('GET', '/api/tree', { cookie: mia2.cookie })).status, 401);
  assert.equal((await login('mia', 'mia long password 12')).r.status, 401);
});

test('logout ends the session', async () => {
  const s = await login('ada', ADMIN_PW);
  assert.equal((await request('POST', '/api/logout', { cookie: s.cookie, csrf: s.csrf, body: {} })).status, 200);
  assert.equal((await request('GET', '/api/tree', { cookie: s.cookie })).status, 401);
});

test('no password appears in the auth log', () => {
  const all = logs.join('\n');
  for (const pw of [ADMIN_PW, EDITOR_PW, 'mia long password']) assert.ok(!all.includes(pw));
  assert.match(all, /\[auth\].*login-failed/);
});

test('over HTTPS the session cookie is __Host- prefixed and the old name is expired', async () => {
  CONFIG.cookieSecure = true;
  try {
    const r = await request('POST', '/api/login', { body: { name: 'ada', password: ADMIN_PW } });
    assert.equal(r.status, 200);
    const [main, legacy] = r.headers['set-cookie'];
    assert.match(main, /^__Host-ms_session=[^;]+; HttpOnly; SameSite=Strict; Path=\/; Max-Age=\d+; Secure$/);
    assert.ok(!/Domain=/i.test(main), 'no Domain attribute');
    assert.match(legacy, /^ms_session=; .*Max-Age=0/);
    const cookie = main.split(';')[0];
    assert.equal((await request('GET', '/api/me', { cookie })).status, 200);
    // an unprefixed cookie (for example one planted by a sibling subdomain) is ignored
    const token = cookie.split('=')[1];
    assert.equal((await request('GET', '/api/me', { cookie: `ms_session=${token}` })).status, 401);
    // logout clears both names
    const out = await request('POST', '/api/logout', { cookie, csrf: r.json.csrf, body: {} });
    assert.equal(out.status, 200);
    assert.match(out.headers['set-cookie'][0], /^__Host-ms_session=; .*Path=\/; Max-Age=0; Secure$/);
    assert.match(out.headers['set-cookie'][1], /^ms_session=; .*Max-Age=0/);
    assert.equal((await request('GET', '/api/me', { cookie })).status, 401);
  } finally { CONFIG.cookieSecure = false; }
});

test('over plain HTTP the unprefixed cookie name still works', async () => {
  const s = await login('ada', ADMIN_PW);
  assert.match(s.cookie, /^ms_session=/);
  assert.equal(s.r.headers['set-cookie'].length, 1);
  assert.equal((await request('GET', '/api/me', { cookie: s.cookie })).status, 200);
  assert.equal((await request('GET', '/api/me', { cookie: s.cookie.replace('ms_session', '__Host-ms_session') })).status, 401);
});

test('admin console and legacy URLs enforce the administrator role', async () => {
  await users.create({name:'console-admin',role:'admin',password:ADMIN_PW});
  await users.create({name:'console-editor',role:'editor',password:EDITOR_PW,sections:[]});
  for (const route of ['/admin', '/admin/users', '/admin/links']) {
    assert.equal((await request('GET', route)).status, 302);
    const ed = await login('console-editor', EDITOR_PW);
    assert.equal((await request('GET', route, {cookie: ed.cookie})).status, 403);
  }
  const admin = await login('console-admin', ADMIN_PW);
  const page = await request('GET', '/admin', {cookie: admin.cookie});
  assert.equal(page.status, 200);
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.ok(!page.body.includes('__PUBLISH_CONTROLLER__'));
  assert.match(page.body, /Build published/);
  for (const area of ['users', 'links']) {
    const old = await request('GET', '/admin/' + area, {cookie: admin.cookie});
    assert.equal(old.status, 302);
    assert.equal(old.headers.location, '/admin#/' + area);
  }
});

test('admin user detail reports safe session/activity data and persisted sign-in time', async () => {
  const a = await login('ada', ADMIN_PW);
  const r = await request('GET', '/api/users/ada', a);
  assert.equal(r.status, 200);
  assert.ok(Date.parse(r.json.user.lastLoginAt));
  assert.ok(r.json.sessions.length > 0);
  assert.deepEqual(Object.keys(r.json.sessions[0]).sort(), ['createdAt', 'lastActiveAt']);
  assert.ok(r.json.activity.some(e => e.event === 'login'));
  for (const secret of ['passwordHash', 'csrf', 'byHash']) assert.ok(!r.body.includes(secret));
  assert.equal((await request('GET', '/api/users/missing-user', a)).status, 404);
  assert.equal((await request('GET', '/api/users/bad%2Fname', a)).status, 400);
  assert.equal((await request('GET', '/api/users/ada')).status, 401);
  await users.create({ name: 'detail-reader', role: 'editor', password: 'detail reader password', sections: ['it'] });
  const editorUser = await login('detail-reader', 'detail reader password');
  assert.equal((await request('GET', '/api/users/ada', editorUser)).status, 403);
});

test('sign out everywhere requires admin and CSRF, ends sessions and invalidates other process sessions', async () => {
  const a = await login('ada', ADMIN_PW);
  await users.create({ name: 'detail-test', role: 'editor', password: 'detail test password', sections: ['it'] });
  const e = await login('detail-test', 'detail test password');
  assert.equal((await request('POST', '/api/users/sign-out', { cookie: a.cookie, body: { name: 'detail-test' } })).status, 403);
  assert.equal((await request('POST', '/api/users/sign-out', { ...e, body: { name: 'ada' } })).status, 403);
  assert.equal((await request('POST', '/api/users/sign-out', { ...a, body: { name: 'missing-user' } })).status, 400);
  const prior = users.get('detail-test').authVersion;
  const r = await request('POST', '/api/users/sign-out', { ...a, body: { name: 'detail-test' } });
  assert.equal(r.status, 200); assert.equal(r.json.ended, 1);
  assert.equal(users.get('detail-test').authVersion, prior + 1);
  assert.equal((await request('GET', '/api/me', e)).status, 401);
  assert.equal((await request('GET', '/api/users/detail-test', a)).json.sessions.length, 0);
});
