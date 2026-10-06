const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const pages = ['editor.html', 'login.html', 'admin-users.html'];

for (const file of pages) {
  test(`${file}: every inline script carries the CSP nonce placeholder`, () => {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf-8');
    const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
    assert.ok(inline.length > 0);
    for (const tag of inline) assert.ok(tag.includes('nonce="__CSP_NONCE__"'), `${file}: ${tag}`);
  });
}

test('users page edits sections and passwords in dialogs, not inline forms', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'admin-users.html'), 'utf-8');
  for (const id of ['addDlg', 'secDlg', 'rstDlg']) assert.ok(html.includes(`<dialog id="${id}"`), id);
  assert.equal(html.includes('confirm('), false, 'no native confirm()');
  assert.ok(html.includes("'X-CSRF-Token'"), 'mutations still send the CSRF token');
});

test('editor keeps the context target for rename and delete callbacks', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf-8');
  const start = html.indexOf("contextMenu.addEventListener('click'");
  const end = html.indexOf('hideContextMenu();', start);
  const block = html.slice(start, end > 0 ? end : start + 2500);
  assert.ok(block.includes('const target = contextTarget'));
  assert.equal(/contextTarget\.(path|type)/.test(block), false, 'callbacks must not read the cleared contextTarget');
});

test('editor tree state is pruned to the server tree and cleared on sign out', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf-8');
  assert.ok(html.includes('editor-tree-open:'));
  assert.ok(/removeItem\(k\)/.test(html), 'sign out clears stored tree state');
});
