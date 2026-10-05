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
  const users = new UserStore(path.join(tmp, 'users.json'), { hashOpts: { N: 1 << 10 } });
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

test('repeated failures lock the account, even for the right password', async () => {
  for (let i = 0; i < 3; i++) await request('POST', '/api/login', { body: { name: 'lockme', password: 'wrong wrong wrong' } });
  const r = await request('POST', '/api/login', { body: { name: 'lockme', password: 'wrong wrong wrong' } });
  assert.equal(r.status, 429);
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

test('admin manages users; reset gives a one-time password, ends sessions and forces a change', async () => {
  const admin = await login('ada', ADMIN_PW);
  const ed = await login('ian', EDITOR_PW);
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
