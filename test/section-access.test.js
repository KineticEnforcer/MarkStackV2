'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { authorize, filterTree, cleanSegments, isValidSectionName } = require('../lib/section-access.js');

let tmp, contentDir;
const editor = { role: 'editor', sections: ['it'] };
const admin = { role: 'admin' };
const can = (u, a, p, extra) => authorize(u, a, p, { contentDir, ...(extra || {}) });

test.before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-authz-'));
  contentDir = path.join(tmp, 'content');
  fs.mkdirSync(path.join(contentDir, 'it', 'sub'), { recursive: true });
  fs.mkdirSync(path.join(contentDir, 'it-evil'));
  fs.mkdirSync(path.join(contentDir, 'marketing'));
  fs.writeFileSync(path.join(contentDir, '_index.md'), 'root');
  fs.writeFileSync(path.join(contentDir, 'it', 'a.md'), 'a');
  fs.writeFileSync(path.join(contentDir, 'marketing', 'm.md'), 'm');
  fs.writeFileSync(path.join(tmp, 'outside.md'), 'outside');
  fs.symlinkSync(path.join(contentDir, 'marketing'), path.join(contentDir, 'it', 'to-marketing'));
  fs.symlinkSync(path.join(tmp, 'outside.md'), path.join(contentDir, 'it', 'to-outside.md'));
  fs.symlinkSync(path.join(contentDir, 'it'), path.join(contentDir, 'alias-it'));
});
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('editor can use their own section', () => {
  for (const a of ['list', 'read', 'write', 'create', 'delete']) {
    assert.equal(can(editor, a, 'it/a.md').allow, true, a);
  }
  assert.equal(can(editor, 'create', 'it/sub/new.md').allow, true);
  assert.equal(can(editor, 'rename', 'it/a.md', { newRelPath: 'it/sub/b.md' }).allow, true);
});

test('editor gets 404 for other sections, siblings with the same prefix, and the content root', () => {
  for (const p of ['marketing/m.md', 'it-evil', 'it-evil/x.md', '_index.md', 'nothing-here/x.md']) {
    const d = can(editor, 'read', p);
    assert.equal(d.allow, false, p);
    assert.equal(d.status, 404, p);
  }
});

test('editor cannot write, create, delete or rename outside their sections', () => {
  for (const a of ['write', 'create', 'delete']) {
    assert.equal(can(editor, a, 'marketing/m.md').allow, false, a);
  }
  assert.equal(can(editor, 'rename', 'marketing/m.md', { newRelPath: 'marketing/z.md' }).allow, false);
  for (const a of ['write', 'create', 'delete', 'list']) {
    assert.equal(can(editor, a, 'marketing/m.md').status, 404, a + ' answers as if it does not exist');
  }
});

test('editor cannot move files into or out of a section', () => {
  assert.equal(can(editor, 'rename', 'it/a.md', { newRelPath: 'marketing/a.md' }).allow, false);
  assert.equal(can(editor, 'rename', 'it/a.md', { newRelPath: 'it/../marketing/a.md' }).allow, false);
  assert.equal(can(editor, 'rename', 'it/a.md', { newRelPath: '../outside.md' }).allow, false);
  assert.equal(can(editor, 'rename', 'it/a.md', {}).allow, false);
});

test('editor cannot rename, delete or overwrite the section folder itself', () => {
  assert.equal(can(editor, 'delete', 'it').allow, false);
  assert.equal(can(editor, 'rename', 'it', { newRelPath: 'it2' }).allow, false);
  assert.equal(can(editor, 'write', 'it').allow, false);
  assert.equal(can(editor, 'create', 'brand-new-top-level').allow, false);
});

test('path tricks are rejected', () => {
  for (const p of ['../outside.md', 'it/../marketing/m.md', 'it/../../outside.md', '/etc/passwd', 'C:\\x', 'it\0/a.md', '', '.', 'it\\..\\marketing\\m.md', '..']) {
    assert.equal(can(editor, 'read', p).allow, false, JSON.stringify(p));
    assert.equal(can(admin, 'read', p).allow, false, 'admin ' + JSON.stringify(p));
  }
  assert.equal(can(editor, 'read', 'it//a.md').allow, true);
  assert.equal(can(editor, 'read', './it/a.md').allow, true);
});

test('symlinks cannot be used to leave the section or content', () => {
  assert.equal(can(editor, 'read', 'it/to-marketing/m.md').allow, false);
  assert.equal(can(editor, 'write', 'it/to-marketing/new.md').allow, false);
  assert.equal(can(editor, 'read', 'it/to-outside.md').allow, false);
  assert.equal(can(admin, 'read', 'it/to-outside.md').allow, false);
  // a link that points at the editor's own section from outside does not grant a second name for it
  assert.equal(can(editor, 'read', 'alias-it/a.md').allow, false);
});

test('case differences are not treated as the same section', () => {
  assert.equal(can(editor, 'read', 'IT/a.md').allow, false);
  assert.equal(can(editor, 'write', 'It/new.md').allow, false);
});

test('admin may use any section but not leave content', () => {
  assert.equal(can(admin, 'write', 'marketing/m.md').allow, true);
  assert.equal(can(admin, 'create', 'brand-new/_index.md').allow, true);
  assert.equal(can(admin, 'rename', 'it/a.md', { newRelPath: 'marketing/a.md' }).allow, true);
  assert.equal(can(admin, 'read', 'it/to-marketing/m.md').allow, true);
});

test('no user, wrong role, unknown action', () => {
  assert.equal(can(null, 'read', 'it/a.md').status, 401);
  assert.equal(can({ role: 'viewer' }, 'read', 'it/a.md').allow, false);
  assert.equal(can(editor, 'build', 'it/a.md').allow, false);
  assert.equal(can({ role: 'editor' }, 'read', 'it/a.md').allow, false);
  assert.equal(can({ role: 'editor', sections: ['../marketing'] }, 'read', 'marketing/m.md').allow, false);
});

test('tree filter hides other sections from editors and shows everything to admins', () => {
  const tree = [
    { name: 'it', path: 'it', type: 'folder', children: [] },
    { name: 'marketing', path: 'marketing', type: 'folder', children: [] },
    { name: '_index.md', path: '_index.md', type: 'file' },
  ];
  assert.deepEqual(filterTree(editor, tree).map(n => n.name), ['it']);
  assert.equal(filterTree(admin, tree).length, 3);
  assert.deepEqual(filterTree({ role: 'editor' }, tree), []);
});

test('helpers', () => {
  assert.deepEqual(cleanSegments('a//b/./c'), ['a', 'b', 'c']);
  assert.equal(cleanSegments('a/../b'), null);
  assert.equal(isValidSectionName('it'), true);
  assert.equal(isValidSectionName('It'), false);
  assert.equal(isValidSectionName('a/b'), false);
  assert.equal(isValidSectionName('.hidden'), false);
});
