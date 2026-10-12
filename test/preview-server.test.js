'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createPreviewServer } = require('../scripts/serve');
test('built-in preview serves pages and assets, rejects traversal and never serves a symlink outside dist', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-preview-'));
  const root = path.join(tmp, 'dist'); fs.mkdirSync(path.join(root, 'guide'), { recursive: true });
  fs.writeFileSync(path.join(root, 'guide/index.html'), 'guide'); fs.writeFileSync(path.join(root, '404.html'), 'missing');
  fs.writeFileSync(path.join(root, 'asset.js'), '/* local */'); fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret');
  fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(root, 'escape.txt'));
  const server = createPreviewServer(root); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const request = (url, method = 'GET') => new Promise((resolve, reject) => { const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url, method }, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body })); }); req.on('error', reject); req.end(); });
  try {
    assert.equal((await request('/guide')).body, 'guide'); assert.equal((await request('/guide/')).body, 'guide');
    assert.equal((await request('/asset.js?version=1')).type, 'application/javascript'); assert.equal((await request('/guide', 'HEAD')).body, '');
    assert.equal((await request('/missing')).status, 404);
    for (const url of ['/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/%5c..%5csecret.txt', '/escape.txt']) assert.equal((await request(url)).status, 403, url);
    assert.equal((await request('/%ZZ')).status, 400); assert.equal((await request('/asset.js', 'POST')).status, 405);
  } finally { await new Promise(r => server.close(r)); fs.rmSync(tmp, { recursive: true, force: true }); }
});
