'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
test('all committed vendor assets match the source manifest', () => {
  const base = path.join(root, 'static/vendor');
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
  for (const [file, hash] of Object.entries(manifest.sha256)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex'), hash, file);
  assert.match(fs.readFileSync(path.join(base, 'NOTICES.txt'), 'utf8'), /SIL OPEN FONT LICENSE/i);
});
test('runtime templates have no CDN or Google Fonts URLs', () => {
  for (const file of ['templates/base.html', 'editor.html', 'admin.html', 'admin-users.html', 'admin-links.html', 'login.html']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/);
});
test('fonts resolve entirely within the committed font directory', () => {
  const css = fs.readFileSync(path.join(root, 'static/vendor/fonts/fonts.css'), 'utf8');
  assert.doesNotMatch(css, /https?:|@import/);
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(root, 'static/vendor/fonts', match[1])));
});
test('Mermaid is not directly loaded and loader checks for diagram blocks', () => {
  for (const file of ['templates/base.html', 'editor.html']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /<script[^>]+src="[^"]*mermaid\.js/);
  assert.match(fs.readFileSync(path.join(root, 'static/js/mermaid-loader.js'), 'utf8'), /if \(!document\.querySelector\('pre\.mermaid'\)\) return/);
  assert.match(fs.readFileSync(path.join(root, 'editor.html'), 'utf8'), /if \(!mermaidBlocks\.length\) return/);
});
