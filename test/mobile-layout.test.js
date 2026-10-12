'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const editor = fs.readFileSync(path.join(__dirname, '../editor.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
test('mobile editor drawer has a close control and excludes closed content from focus', () => {
  for (const token of ['id="file-drawer"', 'aria-controls="file-drawer"', 'id="drawer-close"', 'id="drawer-refresh"', 'fileDrawer.inert = phoneLayout.matches && !open', 'drawerClose.focus()', "document.activeElement === last", "phoneLayout.addEventListener('change'"])
    assert.ok(editor.includes(token), token);
});
test('phone controls and dialogs use visible height and touch-size inputs', () => {
  for (const token of ['--editor-header-height: 104px', 'minmax(0, 1fr)', 'min-height: 44px', 'max-height: calc(var(--vvh, 100dvh) - 24px)', '.modal-input { font-size: 16px', 'aria-labelledby="modal-title"', 'aria-labelledby="confirm-modal-title"', 'modalReturnFocus', 'confirmReturnFocus'])
    assert.ok(editor.includes(token), token);
});
test('mobile view tabs support keyboard switching without saving or publishing', () => {
  const block = editor.slice(editor.indexOf("viewSwitch.addEventListener('keydown'"), editor.indexOf("fileTreeEl.addEventListener('scroll'"));
  assert.ok(block.includes('ArrowLeft'));
  assert.ok(block.includes('buttons[next].click(); buttons[next].focus();'));
  assert.ok(!block.includes('fetch('));
});
test('admin phone header fits narrow widths and dialogs use the visible viewport', () => {
  for (const token of ['@media (max-width: 360px)', 'header .brand { display: none; }', '#accountMenu { flex: 1; }', 'max-height: calc(var(--admin-vvh, 100dvh) - 24px)', 'interactive-widget=resizes-content', 'id="navClose"', 'aria-controls="adminNav"', 'window.msCloseAdminNav', 'nav.inert = mobile.matches && !open', "document.activeElement===last", "account.addEventListener('keydown'"])
    assert.ok(admin.includes(token), token);
});

test('account controls mount after a slow identity response and preview wraps long prose', () => {
  for (const token of ["document.readyState === 'loading'", 'else mountAccountMenu();', '.preview-article{overflow-wrap:anywhere;}', '.preview-article pre{overflow-wrap:normal;}', '#departure-dialog { top: calc(var(--vvh, 100dvh) / 2)']) assert.ok(editor.includes(token), token);
});
