'use strict';
// Regression tests for the editor's Save state machine. The controller lives in
// editor.html between marker comments; it has no DOM access, so it is extracted
// and run here with a fake text box and a fake server.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf-8');
const a = html.indexOf('// <save-controller>');
const b = html.indexOf('// </save-controller>');
assert.ok(a > 0 && b > a, 'save-controller markers missing in editor.html');
const createSaveController = new Function(html.slice(a, b) + '\nreturn createSaveController;')();

function harness(initialPath = 'a.md', initialText = 'one') {
  const box = { text: initialText };
  const calls = [];
  const pending = [];
  const events = [];
  const ctl = createSaveController({
    getText: () => box.text,
    post: (p, t) => new Promise((resolve, reject) => { calls.push({ p, t }); pending.push({ resolve, reject }); }),
    onChange: (v) => events.push(v.state + (v.dirty ? '+dirty' : '')),
  });
  ctl.load(initialPath, initialText);
  return { box, ctl, calls, pending, events };
}
const tick = () => new Promise((r) => setImmediate(r));

test('clean save marks saved only after the server confirms', async () => {
  const h = harness();
  h.box.text = 'two'; h.ctl.input();
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['idle', true]);
  const p = h.ctl.save();
  assert.strictEqual(h.ctl.view().state, 'saving');
  assert.strictEqual(h.ctl.view().dirty, true, 'still unsaved while pending');
  h.pending[0].resolve({ ok: true }); await p;
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['saved', false]);
  assert.strictEqual(h.calls[0].t, 'two');
});

test('text typed during a pending save stays unsaved', async () => {
  const h = harness();
  h.box.text = 'two'; h.ctl.input();
  const p = h.ctl.save();
  h.box.text = 'two plus more'; h.ctl.input();
  h.pending[0].resolve({ ok: true }); await p;
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['idle', true]);
  assert.strictEqual(h.calls.length, 1);
  // a later save sends the newer text
  const p2 = h.ctl.save(); h.pending[1].resolve({ ok: true }); await p2;
  assert.strictEqual(h.calls[1].t, 'two plus more');
  assert.strictEqual(h.ctl.view().state, 'saved');
});

test('failure keeps the text unsaved and retry works', async () => {
  const h = harness();
  h.box.text = 'x'; h.ctl.input();
  const p = h.ctl.save(); h.pending[0].resolve({ ok: false, error: 'Disk full' }); await p;
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty, h.ctl.view().error], ['error', true, 'Disk full']);
  const p2 = h.ctl.save(); h.pending[1].resolve({ ok: true }); await p2;
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['saved', false]);
  assert.strictEqual(h.calls.length, 2);
});

test('a throwing post is reported as an error, not as saved', async () => {
  const h = harness();
  h.box.text = 'x'; h.ctl.input();
  const p = h.ctl.save(); h.pending[0].reject(new Error('offline')); await p;
  assert.strictEqual(h.ctl.view().state, 'error');
  assert.strictEqual(h.ctl.view().dirty, true);
});

test('save pressed during a pending save is queued and sends the newer text once', async () => {
  const h = harness();
  h.box.text = 'v1'; h.ctl.input();
  const p = h.ctl.save();
  h.box.text = 'v2'; h.ctl.input();
  h.ctl.save(); h.ctl.save();                       // spam: still only one extra request
  assert.strictEqual(h.calls.length, 1);
  h.pending[0].resolve({ ok: true }); await tick();
  assert.strictEqual(h.calls.length, 2);
  assert.strictEqual(h.calls[1].t, 'v2');
  h.pending[1].resolve({ ok: true }); await p; await tick();
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['saved', false]);
});

test('queued save is dropped when nothing changed in between', async () => {
  const h = harness();
  h.box.text = 'v1'; h.ctl.input();
  const p = h.ctl.save(); h.ctl.save();
  h.pending[0].resolve({ ok: true }); await p; await tick();
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(h.ctl.view().state, 'saved');
});

test('queued save is dropped when the first save fails', async () => {
  const h = harness();
  h.box.text = 'v1'; h.ctl.input();
  const p = h.ctl.save(); h.ctl.save();
  h.pending[0].resolve({ ok: false, error: 'nope' }); await p; await tick();
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(h.ctl.view().state, 'error');
});

test('opening another file during a save: the late answer cannot mark the new file saved', async () => {
  const h = harness('a.md', 'A');
  h.box.text = 'A edited'; h.ctl.input();
  const p = h.ctl.save();
  h.box.text = 'B'; h.ctl.load('b.md', 'B');
  assert.deepStrictEqual([h.ctl.view().path, h.ctl.view().state, h.ctl.view().dirty], ['b.md', 'idle', false]);
  h.pending[0].resolve({ ok: true }); await p;
  assert.deepStrictEqual([h.ctl.view().path, h.ctl.view().state, h.ctl.view().dirty], ['b.md', 'idle', false]);
  h.box.text = 'B edited'; h.ctl.input();           // original of b.md must still be 'B'
  assert.strictEqual(h.ctl.view().dirty, true);
});

test('a late failure for the old file does not show an error on the new file', async () => {
  const h = harness('a.md', 'A');
  h.box.text = 'A2'; h.ctl.input();
  const p = h.ctl.save();
  h.box.text = 'B'; h.ctl.load('b.md', 'B');
  h.pending[0].resolve({ ok: false, error: 'late' }); await p;
  assert.strictEqual(h.ctl.view().state, 'idle');
  assert.strictEqual(h.ctl.view().error, '');
});

test('saving unchanged text sends nothing; typing after saved flips back to unsaved', async () => {
  const h = harness();
  await h.ctl.save();
  assert.strictEqual(h.calls.length, 0);
  h.box.text = 'two'; h.ctl.input();
  const p = h.ctl.save(); h.pending[0].resolve({ ok: true }); await p;
  assert.strictEqual(h.ctl.view().state, 'saved');
  h.box.text = 'three'; h.ctl.input();
  assert.deepStrictEqual([h.ctl.view().state, h.ctl.view().dirty], ['idle', true]);
  h.box.text = 'two'; h.ctl.input();
  assert.strictEqual(h.ctl.view().dirty, false);
});
