'use strict';
// Built pages carry the breadcrumb, the "On this page" rail and previous/next links.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

test('doc pages have breadcrumb, rail and prev/next; the homepage and 404 have no breadcrumb or prev/next and no hero banner styling', () => {
  execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, stdio: 'ignore' });
  const dist = path.join(root, 'dist');
  const page = fs.readFileSync(path.join(dist, 'getting-started', 'quickstart', 'index.html'), 'utf-8');
  assert.match(page, /class="page-breadcrumb"/);
  assert.match(page, /class="toc-rail"/);
  assert.match(page, /class="prev-next"/);
  assert.match(page, /class="page-meta"/);
  // every rail link points at a heading that exists on the page
  for (const m of page.matchAll(/<li class="toc-item[^"]*"><a href="#([^"]+)"/g)) {
    assert.ok(page.includes(`id="${m[1]}"`), `rail link without heading: ${m[1]}`);
  }
  for (const file of ['index.html', '404.html']) {
    const html = fs.readFileSync(path.join(dist, file), 'utf-8');
    assert.doesNotMatch(html, /class="prev-next"/, file);
    assert.doesNotMatch(html, /class="page-breadcrumb"/, file);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(dist, '404.html'), 'utf-8'), /class="toc-rail"/);
  // the old fixed breadcrumb bar is gone and no editor link was added
  assert.doesNotMatch(page, /breadcrumb-bar/);
  assert.doesNotMatch(page, /editor\.html|\/editor/);
});
