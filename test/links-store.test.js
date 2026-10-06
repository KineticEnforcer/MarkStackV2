'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const L = require('../lib/links-store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'links-'));

test('a valid list gets ids, and show defaults to on', () => {
  const r = L.validateList([{ title: ' Docs  site ', url: 'https://example.com/a?b=1' }, { title: 'X', url: 'http://x.org', show: false }]);
  assert.ok(!r.error);
  assert.strictEqual(r.links[0].title, 'Docs site');
  assert.match(r.links[0].id, /^[a-f0-9]{12}$/);
  assert.notStrictEqual(r.links[0].id, r.links[1].id);
  assert.strictEqual(r.links[0].show, true);
  assert.strictEqual(r.links[1].show, false);
});

test('bad input is refused with a reason', () => {
  const bad = [
    [{ title: '', url: 'https://a.com' }], [{ title: 'x'.repeat(41), url: 'https://a.com' }],
    [{ title: 'a', url: 'javascript:alert(1)' }], [{ title: 'a', url: 'data:text/html,x' }], [{ title: 'a', url: 'ftp://a.com' }],
    [{ title: 'a', url: 'https://u:p@a.com' }], [{ title: 'a', url: 'not a url' }], [{ title: 'a', url: 'https://a.com/' + 'x'.repeat(2000) }],
    'nope', [null], Array.from({ length: 31 }, () => ({ title: 'a', url: 'https://a.com' }))
  ];
  for (const b of bad) assert.ok(L.validateList(b).error, JSON.stringify(b).slice(0, 60));
});

test('duplicate or forged ids and favicon names are repaired or dropped', () => {
  const r = L.validateList([{ id: 'aaaaaaaaaaaa', title: 'a', url: 'https://a.com', favicon: '../../etc/passwd' }, { id: 'aaaaaaaaaaaa', title: 'b', url: 'https://b.com', favicon: 'aaaaaaaaaaaa.png' }, { id: '../x', title: 'c', url: 'https://c.com' }]);
  assert.strictEqual(new Set(r.links.map(l => l.id)).size, 3);
  assert.strictEqual(r.links[0].favicon, '');
  assert.strictEqual(r.links[1].favicon, 'aaaaaaaaaaaa.png');
  assert.match(r.links[2].id, /^[a-f0-9]{12}$/);
});

test('write then read round-trips; orphaned icons are deleted, used ones kept', () => {
  const d = tmp();
  const a = L.saveFavicon(d, 'aaaaaaaaaaaa', 'png', Buffer.from('p'));
  L.saveFavicon(d, 'bbbbbbbbbbbb', 'ico', Buffer.from('i'));
  fs.writeFileSync(path.join(d, 'favicons', 'notes.txt'), 'keep me');
  const links = [{ id: 'aaaaaaaaaaaa', title: 'A', url: 'https://a.com/', show: true, favicon: a }];
  L.writeLinks(d, links);
  assert.deepStrictEqual(L.readLinks(d), links);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, 'favicons')).sort(), ['aaaaaaaaaaaa.png', 'notes.txt']);
});

test('a missing, damaged or hostile file reads as an empty or reduced list, never throws', () => {
  const d = tmp();
  assert.deepStrictEqual(L.readLinks(d), []);
  fs.writeFileSync(path.join(d, 'links.json'), '{not json');
  assert.deepStrictEqual(L.readLinks(d), []);
  fs.writeFileSync(path.join(d, 'links.json'), JSON.stringify({ links: [{ id: 'aaaaaaaaaaaa', title: 'ok', url: 'https://ok.com' }, { id: 'bbbbbbbbbbbb', title: 'bad', url: 'javascript:alert(1)' }, { title: 'noid', url: 'https://x.com' }, 5] }));
  const r = L.readLinks(d);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title, 'ok');
  assert.throws(() => L.saveFavicon(d, '../evil', 'png', Buffer.from('x')));
});
