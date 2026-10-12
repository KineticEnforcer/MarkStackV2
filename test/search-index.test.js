'use strict';
// The built search index must point at pages and headings that exist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function buildForTest(t) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-search-index-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  execFileSync(process.execPath, [path.join(root, 'build.js'), '--out', dist], { cwd: root, stdio: 'ignore' });
  return dist;
}

test('search index entries link to real pages and heading anchors', (t) => {
  const dist = buildForTest(t);
  const index = JSON.parse(fs.readFileSync(path.join(dist, 'search-index.json'), 'utf-8'));
  assert.ok(index.some(e => e.type === 'page'));
  assert.ok(index.some(e => e.type === 'section'));
  for (const e of index) {
    assert.ok(['page', 'section'].includes(e.type));
    assert.equal(typeof e.title, 'string');
    assert.ok(e.title.length > 0, `empty title for ${e.url}`);
    assert.ok(Array.isArray(e.path));
    const [pagePath, hash] = e.url.split('#');
    const file = path.join(dist, pagePath, 'index.html');
    assert.ok(fs.existsSync(file), `missing page for ${e.url}`);
    if (e.type === 'section') {
      assert.ok(hash, `section without anchor: ${e.url}`);
      assert.ok(fs.readFileSync(file, 'utf-8').includes(`id="${hash}"`), `anchor not found: ${e.url}`);
    }
  }
});
