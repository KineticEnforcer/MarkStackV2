'use strict';
// Regression tests for the editor server hardening. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const editor = require('../editor-server.js');
const { server, CONFIG } = editor;

let tmp, port;

function request(method, urlPath, { body, headers = {}, host } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = { Host: host || `127.0.0.1:${port}`, ...headers };
    if (data !== null && !h['Content-Type'] && !h['content-type']) h['Content-Type'] = 'application/json';
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }));
    });
    req.on('error', reject);
    if (data !== null) req.write(data);
    req.end();
  });
}

test.before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-test-'));
  CONFIG.contentDir = path.join(tmp, 'content');
  fs.mkdirSync(path.join(CONFIG.contentDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(CONFIG.contentDir, 'docs', 'a.md'), '# a\n');
  fs.mkdirSync(path.join(tmp, 'content-evil'));
  fs.writeFileSync(path.join(tmp, 'content-evil', 'x.md'), 'secret');
  fs.writeFileSync(path.join(tmp, 'outside.md'), 'outside');
  CONFIG.maxBodyBytes = 1024;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  CONFIG.port = port;
});

test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('default bind host is loopback', () => {
  assert.equal(require('../editor-server.js').CONFIG.host, process.env.MARKSTACK_EDITOR_HOST || '127.0.0.1');
});

test('reads a normal file', async () => {
  const r = await request('GET', '/api/file?path=docs/a.md');
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).content, '# a\n');
});

test('sibling directory with the same prefix is not readable', async () => {
  const r = await request('GET', '/api/file?path=' + encodeURIComponent('../content-evil/x.md'));
  assert.equal(r.status, 403);
});

test('sibling directory with the same prefix is not writable', async () => {
  const r = await request('POST', '/api/file', { body: { path: '../content-evil/w.md', content: 'pwn' } });
  assert.equal(r.status, 403);
  assert.equal(fs.existsSync(path.join(tmp, 'content-evil', 'w.md')), false);
});

test('traversal to a parent file is blocked', async () => {
  const r = await request('GET', '/api/file?path=' + encodeURIComponent('../outside.md'));
  assert.equal(r.status, 403);
});

test('symlink inside content cannot reach outside', async (t) => {
  try { fs.symlinkSync(tmp, path.join(CONFIG.contentDir, 'link')); } catch (e) { return t.skip('symlinks unavailable'); }
  const r = await request('GET', '/api/file?path=link/outside.md');
  assert.equal(r.status, 403);
  const w = await request('POST', '/api/file', { body: { path: 'link/new.md', content: 'x' } });
  assert.equal(w.status, 403);
  assert.equal(fs.existsSync(path.join(tmp, 'new.md')), false);
  fs.unlinkSync(path.join(CONFIG.contentDir, 'link'));
});

test('content root cannot be deleted', async () => {
  for (const p of ['.', './', 'docs/..', 'docs/../.']) {
    const r = await request('DELETE', '/api/delete?path=' + encodeURIComponent(p));
    assert.equal(r.status, 403, `path ${p}`);
  }
  assert.equal(fs.existsSync(path.join(CONFIG.contentDir, 'docs', 'a.md')), true);
});

test('content root cannot be renamed', async () => {
  const r = await request('POST', '/api/rename', { body: { oldPath: '.', newName: 'x', isFolder: true } });
  assert.notEqual(r.status, 200);
  assert.equal(fs.existsSync(CONFIG.contentDir), true);
});

test('save requires string path and content', async () => {
  assert.equal((await request('POST', '/api/file', { body: { path: 5, content: 'x' } })).status, 400);
  assert.equal((await request('POST', '/api/file', { body: { path: 'ok.md' } })).status, 400);
  assert.equal((await request('POST', '/api/file', { body: { path: 'a\0b.md', content: 'x' } })).status, 400);
});

test('legit save, create, rename, delete still work', async () => {
  assert.equal((await request('POST', '/api/file', { body: { path: 'docs/b.md', content: 'hi' } })).status, 200);
  assert.equal((await request('POST', '/api/create-file', { body: { parentPath: 'docs', name: 'c' } })).status, 200);
  assert.equal((await request('POST', '/api/rename', { body: { oldPath: 'docs/c.md', newName: 'd', isFolder: false } })).status, 200);
  assert.equal((await request('DELETE', '/api/delete?path=docs/d.md')).status, 200);
});

test('text/plain POST (cross-site simple request) is rejected', async () => {
  const r = await request('POST', '/api/file', {
    headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ path: 'zz.md', content: 'x' }) });
  assert.equal(r.status, 415);
  assert.equal(fs.existsSync(path.join(CONFIG.contentDir, 'zz.md')), false);
});

test('cross-origin Origin header is rejected', async () => {
  const r = await request('GET', '/api/tree', { headers: { Origin: 'http://evil.example' } });
  assert.equal(r.status, 403);
  const ok = await request('GET', '/api/tree', { headers: { Origin: `http://127.0.0.1:${port}` } });
  assert.equal(ok.status, 200);
});

test('unknown Host header (DNS rebinding) is rejected', async () => {
  const r = await request('GET', '/api/tree', { host: `attacker.example:${port}` });
  assert.equal(r.status, 403);
});

test('oversized body is rejected with 413 and not written', async () => {
  const r = await request('POST', '/api/file', { body: { path: 'big.md', content: 'A'.repeat(5000) } });
  assert.equal(r.status, 413);
  assert.equal(fs.existsSync(path.join(CONFIG.contentDir, 'big.md')), false);
});

test('errors do not leak filesystem paths', async () => {
  const r = await request('POST', '/api/file', { body: { path: 'docs/a.md/inner.md', content: 'x' } });
  assert.equal(r.status, 500);
  assert.equal(r.body.includes(tmp), false);
});

test('static route cannot escape the static directory', async () => {
  for (const p of ['/static/..%2fpackage.json', '/static/%2e%2e/package.json', '/css/..%2f..%2fpackage.json', '/js/..%2fpackage.json']) {
    const r = await request('GET', p);
    assert.ok([403, 404].includes(r.status), `${p} -> ${r.status}`);
    assert.equal(r.body.includes('"name"'), false);
  }
});

test('security headers are present', async () => {
  const r = await request('GET', '/api/tree');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-frame-options'], 'DENY');
});

test('editor page is served with a nonce CSP and no unpinned scripts', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  const csp = r.headers['content-security-policy'];
  assert.ok(csp, 'CSP header present');
  const nonce = (csp.match(/'nonce-([^']+)'/) || [])[1];
  assert.ok(nonce, 'nonce in CSP');
  assert.ok(r.body.includes(`<script nonce="${nonce}">`), 'inline scripts carry the nonce');
  assert.equal(r.body.includes('__CSP_NONCE__'), false);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(/script-src[^;]*'unsafe-(inline|eval)'/.test(csp), false);
  const second = (await request('GET', '/')).headers['content-security-policy'].match(/'nonce-([^']+)'/)[1];
  assert.notEqual(second, nonce, 'nonce changes per response');
});

test('every external script is version-pinned, has integrity, and is allowed by hash in the CSP', async () => {
  const r = await request('GET', '/');
  const csp = r.headers['content-security-policy'];
  const tags = r.body.match(/<script[^>]*\ssrc="https?:[^"]*"[^>]*>/g) || [];
  assert.ok(tags.length >= 2);
  for (const t of tags) {
    assert.match(t, /@\d+\.\d+\.\d+\//, 'exact version in URL: ' + t);
    const integrity = (t.match(/integrity="([^"]+)"/) || [])[1];
    assert.ok(integrity && csp.includes(`'${integrity}'`), 'integrity hash allowed in CSP: ' + t);
  }
});

test('markdown-it is served from the installed package', async () => {
  const r = await request('GET', '/vendor/markdown-it.js');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /javascript/);
  assert.ok(r.body.includes('markdownit'));
});
