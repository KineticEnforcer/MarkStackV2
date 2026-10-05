'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../static/js/search-core.js');

const index = S.prepare([
  { type: 'page', title: 'Server configuration', url: '/guides/server/', path: ['Guides'], text: 'Settings for the local server.' },
  { type: 'section', title: 'Changing the port', url: '/guides/server/#changing-the-port', path: ['Guides', 'Server configuration'], text: 'Set port in siteconfig.json, then restart.' },
  { type: 'page', title: 'Troubleshooting', url: '/ref/troubleshooting/', path: ['Reference'], text: 'Common problems and fixes.' },
  { type: 'section', title: 'Editor port and host', url: '/ref/troubleshooting/#editor-port', path: ['Reference', 'Troubleshooting'], text: 'If the port is already in use, change the configuration.' },
  { type: 'page', title: 'Quickstart', url: '/start/', path: [], text: 'Install dependencies and build your first site.' },
]);
const urls = r => [].concat(r.pages, r.sections).map(h => h.entry.url);

test('partial words match (prefix)', () => {
  assert.ok(urls(S.search(index, 'conf')).includes('/guides/server/'));
});
test('every typed word must match', () => {
  const r = S.search(index, 'port zebra');
  assert.deepEqual(urls(r), []);
  assert.ok(urls(S.search(index, 'port conf')).includes('/ref/troubleshooting/#editor-port'));
});
test('small typos still match, but short words are strict', () => {
  assert.ok(urls(S.search(index, 'configration')).includes('/guides/server/'));
  assert.ok(urls(S.search(index, 'troubelshooting')).includes('/ref/troubleshooting/'));
  assert.deepEqual(urls(S.search(index, 'quikstrt zz')), []);
  assert.deepEqual(urls(S.search(index, 'prot')), []);
});
test('quoted phrases must appear exactly', () => {
  assert.ok(urls(S.search(index, '"changing the port"')).includes('/guides/server/#changing-the-port'));
  assert.deepEqual(urls(S.search(index, '"port changing"')), []);
});
test('titles rank above body text and exact titles first', () => {
  const r = S.search(index, 'quickstart');
  assert.equal(r.pages[0].entry.url, '/start/');
  const r2 = S.search(index, 'port');
  assert.equal(r2.sections[0].entry.url, '/guides/server/#changing-the-port');
});
test('empty and one-letter queries return nothing', () => {
  assert.deepEqual(urls(S.search(index, '')), []);
  assert.deepEqual(urls(S.search(index, 'a')), []);
});
test('withinEdits handles swaps and length differences', () => {
  assert.equal(S.withinEdits('port', 'prot', 1), true);
  assert.equal(S.withinEdits('port', 'ports', 1), true);
  assert.equal(S.withinEdits('port', 'pxxt', 1), false);
});
test('highlight ranges and excerpt', () => {
  const t = 'Set the port in the configuration file, then restart the server now.';
  const rs = S.highlightRanges(t, 'port conf');
  assert.deepEqual(rs.map(r => t.slice(r[0], r[1])), ['port', 'conf']);
  assert.ok(S.excerpt(t.repeat(5), 'restart').includes('restart'));
});
test('quoted phrase words are highlighted and the excerpt is centred on the phrase', () => {
  const t = 'x '.repeat(80) + 'the web server answers requests' + ' y'.repeat(80);
  const ex = S.excerpt(t, '"web server"');
  assert.ok(ex.includes('web server'));
  const rs = S.highlightRanges('the web server', '"web server"');
  assert.deepEqual(rs.length, 2);
  assert.equal(S.highlightRanges('web server serves', '"web server"').length, 2);
});
test('no HTML is produced by the core', () => {
  const r = S.search(S.prepare([{ type: 'page', title: '<img src=x onerror=alert(1)>', url: '/x/', path: [], text: 'x' }]), 'img');
  assert.equal(typeof r.pages[0].entry.title, 'string');
});
