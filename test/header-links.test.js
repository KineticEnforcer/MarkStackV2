'use strict';
// Header links: the build, Publish, and the administrator API. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { Publisher } = require('../lib/publish');
const store = require('../lib/links-store');

const ROOT = path.join(__dirname, '..');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(30, 7)]);
const mkTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ms-links-'));

function smallContent(tmp) {
  const c = path.join(tmp, 'content');
  fs.mkdirSync(path.join(c, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(c, '_index.md'), '---\ntitle: Home\n---\n# Home\n');
  fs.writeFileSync(path.join(c, 'docs', 'a.md'), '---\ntitle: A\n---\n# A\nhello\n');
  return c;
}
function build(tmp, dataDir) {
  const out = path.join(tmp, 'out');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'build.js'), '--out', out, '--content', path.join(tmp, 'content'), ...(dataDir ? ['--data', dataDir] : [])], { cwd: ROOT, encoding: 'utf-8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return out;
}

test('build: shown links appear escaped in the header, hidden ones do not, there is no footer or built-in GitHub button', () => {
  const tmp = mkTmp(); smallContent(tmp);
  const data = path.join(tmp, 'data');
  store.writeLinks(data, [
    { id: 'aaaaaaaaaaaa', title: 'Dev <b>"site"</b>', url: 'https://example.com/?a=1&b=2', show: true, favicon: '' },
    { id: 'bbbbbbbbbbbb', title: 'Secret', url: 'https://hidden.example', show: false, favicon: '' }
  ]);
  const out = build(tmp, data);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf-8');
  assert.match(html, /class="header-link"[^>]*href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  assert.match(html, /Dev &lt;b&gt;&quot;site&quot;&lt;\/b&gt;/);
  assert.ok(!html.includes('<b>"site"'));
  assert.ok(!html.includes('hidden.example'));
  assert.ok(!html.includes('site-footer') && !html.includes('github-link') && !html.includes('KineticEnforcer/MarkStack'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  const page = fs.readFileSync(path.join(out, 'docs', 'a', 'index.html'), 'utf-8');
  assert.ok(page.includes('header-link'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('build: an icon on disk is copied to the site; a missing one falls back to the generic icon', () => {
  const tmp = mkTmp(); smallContent(tmp);
  const data = path.join(tmp, 'data');
  const name = store.saveFavicon(data, 'aaaaaaaaaaaa', 'png', PNG);
  store.writeLinks(data, [
    { id: 'aaaaaaaaaaaa', title: 'One', url: 'https://one.example', show: true, favicon: name },
    { id: 'bbbbbbbbbbbb', title: 'Two', url: 'https://two.example', show: true, favicon: 'bbbbbbbbbbbb.png' }
  ]);
  const out = build(tmp, data);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf-8');
  assert.ok(html.includes('src="/favicons/aaaaaaaaaaaa.png"') || /src="[^"]*favicons\/aaaaaaaaaaaa\.png"/.test(html));
  assert.ok(fs.readFileSync(path.join(out, 'favicons', 'aaaaaaaaaaaa.png')).equals(PNG));
  assert.ok(!fs.existsSync(path.join(out, 'favicons', 'bbbbbbbbbbbb.png')));
  assert.ok(html.includes('<svg class="header-link-icon"'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('build: a damaged or hostile links file never breaks the build', () => {
  const tmp = mkTmp(); smallContent(tmp);
  const data = path.join(tmp, 'data'); fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'links.json'), '{broken');
  let html = fs.readFileSync(path.join(build(tmp, data), 'index.html'), 'utf-8');
  assert.ok(!html.includes('class="header-link"'));
  fs.writeFileSync(path.join(data, 'links.json'), JSON.stringify({ links: [{ id: 'aaaaaaaaaaaa', title: 'x', url: 'javascript:alert(1)', show: true }, { id: 'bbbbbbbbbbbb', title: 'ok', url: 'https://ok.example', show: true, favicon: '../../x.png' }] }));
  html = fs.readFileSync(path.join(build(tmp, data), 'index.html'), 'utf-8');
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('https://ok.example'));
  assert.ok(!html.includes('../../x.png'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('publish: links and icons are snapshotted into the build and count as changes', async () => {
  const tmp = mkTmp(); smallContent(tmp);
  const data = path.join(tmp, 'data');
  const name = store.saveFavicon(data, 'aaaaaaaaaaaa', 'png', PNG);
  store.writeLinks(data, [{ id: 'aaaaaaaaaaaa', title: 'Live', url: 'https://live.example', show: true, favicon: name }]);
  const distDir = path.join(tmp, 'dist'); fs.mkdirSync(distDir); fs.writeFileSync(path.join(distDir, 'index.html'), 'OLD');
  const p = new Publisher({ root: ROOT, contentDir: path.join(tmp, 'content'), staticDir: path.join(ROOT, 'static'), templatesDir: path.join(ROOT, 'templates'), distDir, buildScript: path.join(ROOT, 'build.js'), dataDir: data, stateFile: path.join(tmp, 'state', 'publish-state.json') });
  p.start('admin1'); await p.finished();
  assert.equal(p.status().state, 'done', JSON.stringify(p.status().error));
  assert.match(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), /live\.example/);
  assert.ok(fs.existsSync(path.join(distDir, 'favicons', name)));
  assert.equal(p.unpublished().unpublished, false);
  store.writeLinks(data, []);
  assert.equal(p.unpublished().unpublished, true, 'removing a link counts as an unpublished change');
  assert.deepEqual(fs.readdirSync(tmp).filter(n => n.includes('.publish-')), [], 'no snapshot folder is left behind');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---- administrator API ----
const editor = require('../editor-server.js');
const { server, CONFIG } = editor;
let tmp, port, adminTok, adminCsrf, edTok, edCsrf, calls;
function request(method, urlPath, { body, tok = adminTok, csrf = adminCsrf, anon } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const h = { Host: `127.0.0.1:${port}`, ...(anon ? {} : { Cookie: `ms_session=${tok}`, 'X-CSRF-Token': csrf }) };
    if (data !== null) h['Content-Type'] = 'application/json';
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, raw: Buffer.concat(chunks), get body() { return this.raw.toString(); } }));
    });
    req.on('error', reject); if (data !== null) req.write(data); req.end();
  });
}
const post = (links, o) => request('POST', '/api/links', { body: { links }, ...o });

test.before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-links-api-'));
  CONFIG.usersFile = path.join(tmp, 'users.json');
  CONFIG.contentDir = path.join(tmp, 'content'); fs.mkdirSync(CONFIG.contentDir);
  calls = [];
  CONFIG.faviconFetcher = async (url) => { calls.push(url); if (url.includes('private')) throw new Error('The address points to a private or reserved network'); if (url.includes('noicon')) return null; return { ext: 'png', data: PNG, from: url }; };
  const { UserStore } = require('../lib/user-store');
  const { SessionStore } = require('../lib/sessions');
  const users = new UserStore(CONFIG.usersFile, { hashOpts: { N: 1 << 10 } });
  await users.create({ name: 'admin1', role: 'admin', password: 'a long admin password' });
  await users.create({ name: 'ed1', role: 'editor', password: 'a long editor password', sections: [] });
  editor.initAuth({ users, sessions: new SessionStore({ idleMs: 3600e3, maxMs: 7200e3 }) });
  adminTok = editor.AUTH.sessions.create('admin1'); adminCsrf = editor.AUTH.sessions.get(adminTok).csrf;
  edTok = editor.AUTH.sessions.create('ed1'); edCsrf = editor.AUTH.sessions.get(edTok).csrf;
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port; CONFIG.port = port;
});
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('api: only a signed-in administrator can read or change links, with a valid CSRF token', async () => {
  assert.equal((await request('GET', '/api/links', { anon: true })).status, 401);
  assert.equal((await request('GET', '/api/links', { tok: edTok, csrf: edCsrf })).status, 403);
  assert.equal((await post([], { tok: edTok, csrf: edCsrf })).status, 403);
  assert.equal((await post([{ title: 'x', url: 'https://x.example' }], { csrf: 'wrong' })).status, 403);
  assert.equal((await request('GET', '/admin/links', { tok: edTok, csrf: edCsrf })).status, 403);
  assert.equal((await request('GET', '/admin/links', { anon: true })).status, 302);
  const old = await request('GET', '/admin/links');
  assert.equal(old.status, 302);
  assert.equal(old.headers.location, '/admin#/links');
  const page = await request('GET', '/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /script-src 'nonce-/);
  assert.ok(!page.body.includes('__CSP_NONCE__'));
  assert.deepEqual(JSON.parse((await request('GET', '/api/links')).body).links, []);
});

test('api: adding fetches the icon once; unchanged links do not refetch; a changed address does', async () => {
  calls.length = 0;
  let r = await post([{ title: 'Alpha', url: 'https://alpha.example' }]);
  assert.equal(r.status, 200, r.body);
  let d = JSON.parse(r.body);
  assert.equal(d.links.length, 1); assert.match(d.links[0].favicon, /^[a-f0-9]{12}\.png$/);
  assert.deepEqual(calls, ['https://alpha.example/']);
  const icon = await request('GET', '/api/links/icon/' + d.links[0].favicon);
  assert.equal(icon.status, 200); assert.equal(icon.headers['content-type'], 'image/png'); assert.ok(icon.raw.equals(PNG));
  assert.equal((await request('GET', '/api/links/icon/' + d.links[0].favicon, { anon: true })).status, 401);
  assert.equal((await request('GET', '/api/links/icon/..%2F..%2Fusers.json')).status, 404);
  calls.length = 0;
  r = await post([{ ...d.links[0], title: 'Alpha 2' }]);
  assert.equal(calls.length, 0, 'a title change does not fetch');
  d = JSON.parse(r.body);
  assert.match(d.links[0].favicon, /\.png$/);
  r = await post([{ ...d.links[0], url: 'https://beta.example' }]);
  assert.equal(calls.length, 1);
  r = await post([{ ...JSON.parse(r.body).links[0], refresh: true }]);
  assert.equal(calls.length, 2, 'explicit refresh fetches again');
});

test('api: a failed or refused icon fetch still saves the link and says why', async () => {
  let r = await post([{ title: 'Intranet', url: 'https://private.example' }, { title: 'Plain', url: 'https://noicon.example' }]);
  assert.equal(r.status, 200, r.body);
  const d = JSON.parse(r.body);
  assert.deepEqual(d.links.map(l => l.favicon), ['', '']);
  assert.match(d.notes[0].reason, /private or reserved/);
  assert.match(d.notes[1].reason, /No icon found/);
});

test('api: bad input is refused and nothing is changed', async () => {
  await post([{ title: 'Keep', url: 'https://keep.example' }]);
  const before = (await request('GET', '/api/links')).body;
  for (const bad of [[{ title: 'x', url: 'javascript:alert(1)' }], [{ title: '', url: 'https://a.example' }], [{ title: 'x', url: 'ftp://a.example' }], 'nope', Array.from({ length: 31 }, (_, i) => ({ title: 't' + i, url: 'https://a.example/' + i }))]) {
    const r = await post(bad); assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 50));
  }
  assert.equal((await request('GET', '/api/links')).body, before);
});

test('api: at most five new icons are fetched per save; removing a link deletes its icon file', async () => {
  calls.length = 0;
  const list = Array.from({ length: 7 }, (_, i) => ({ title: 'L' + i, url: 'https://l' + i + '.example' }));
  const d = JSON.parse((await post(list)).body);
  assert.equal(calls.length, 5);
  assert.equal(d.notes.filter(n => n.icon === 'later').length, 2);
  const dir = path.join(path.dirname(CONFIG.usersFile), 'favicons');
  assert.equal(fs.readdirSync(dir).length, 5);
  await post([]);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('api: changing the address drops the old icon at once, even when the new fetch fails; a failed refresh keeps the old icon', async () => {
  await post([]);
  let d = JSON.parse((await post([{ title: 'Site', url: 'https://good.example' }])).body);
  const old = d.links[0].favicon;
  assert.match(old, /\.png$/);
  const dir = path.join(path.dirname(CONFIG.usersFile), 'favicons');
  assert.ok(fs.existsSync(path.join(dir, old)));
  // refresh that finds nothing: the old icon stays
  d = JSON.parse((await post([{ ...d.links[0], url: 'https://good.example', refresh: true, title: 'Site' }].map(l => ({ ...l })))).body);
  const keepFetcher = CONFIG.faviconFetcher;
  CONFIG.faviconFetcher = async () => null;
  d = JSON.parse((await post([{ ...d.links[0], refresh: true }])).body);
  assert.equal(d.links[0].favicon, old, 'old icon kept on a failed refresh');
  assert.match(d.notes[0].reason, /old icon is kept/);
  // new address, fetch fails: no icon from the old site remains
  CONFIG.faviconFetcher = async () => { throw new Error('boom'); };
  d = JSON.parse((await post([{ ...d.links[0], url: 'https://other.example' }])).body);
  assert.equal(d.links[0].favicon, '');
  assert.ok(!fs.existsSync(path.join(dir, old)), 'old icon file removed');
  assert.equal(JSON.parse((await request('GET', '/api/links')).body).links[0].favicon, '');
  CONFIG.faviconFetcher = keepFetcher;
});

test('build: 30 links render once each inside one nav; the page script only hides or moves them', () => {
  const t = mkTmp(); smallContent(t);
  const data = path.join(t, 'data');
  store.writeLinks(data, Array.from({ length: 30 }, (_, i) => ({ id: String(i).padStart(12, 'a'), title: 'Link ' + i, url: 'https://s' + i + '.example', show: true, favicon: '' })));
  const html = fs.readFileSync(path.join(build(t, data), 'index.html'), 'utf-8');
  assert.equal((html.match(/class="header-link"/g) || []).length, 30);
  assert.equal((html.match(/<nav class="header-links"/g) || []).length, 1);
  fs.rmSync(t, { recursive: true, force: true });
});
