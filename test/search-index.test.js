'use strict';
// The built search index must point at pages and headings that exist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

test('search index entries link to real pages and heading anchors', () => {
  execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, stdio: 'ignore' });
  const dist = path.join(root, 'dist');
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
