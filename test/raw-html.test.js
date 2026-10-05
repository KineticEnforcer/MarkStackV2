'use strict';
// Raw HTML in Markdown is off by default. Callouts must look the same without it.
// The site owner can turn it on in siteconfig.json (a server-side file).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function build(files, siteConfigPatch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-html-'));
  fs.copyFileSync(path.join(root, 'build.js'), path.join(dir, 'build.js'));
  for (const name of ['static', 'templates', 'template']) {
    const src = path.join(root, name);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, name), { recursive: true });
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'siteconfig.json'), 'utf-8'));
  fs.writeFileSync(path.join(dir, 'siteconfig.json'), JSON.stringify({ ...cfg, ...siteConfigPatch }));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(dir, 'content', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  const r = spawnSync(process.execPath, ['build.js'], { cwd: dir, encoding: 'utf-8' });
  const read = p => fs.readFileSync(path.join(dir, 'dist', p, 'index.html'), 'utf-8');
  return { dir, r, read, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const doc = (title, text) => `---\ntitle: ${title}\n---\n${text}\n`;
const RAW = '<script>window.pwned=1</script>\n\n<img src=x onerror="window.pwned2=1">\n\n<iframe src="https://example.invalid/"></iframe>\n';

test('raw HTML in Markdown is shown as text by default', () => {
  const b = build({ '_index.md': doc('Home', 'home'), 'docs/_index.md': doc('Docs', 'x'), 'docs/page.md': doc('Page', RAW) });
  try {
    assert.equal(b.r.status, 0, b.r.stderr);
    const html = b.read('docs/page');
    const body = html.slice(html.indexOf('<article'));
    assert.ok(!/<script>window\.pwned/.test(body));
    assert.ok(!/<img src="?x"? onerror/.test(body));
    assert.ok(!/<iframe src="https:\/\/example\.invalid/.test(body));
    assert.ok(body.includes('&lt;script&gt;window.pwned=1'));
  } finally { b.done(); }
});

test('allowRawHtml true in siteconfig.json lets raw HTML through again', () => {
  const b = build({ '_index.md': doc('Home', 'home'), 'docs/_index.md': doc('Docs', 'x'), 'docs/page.md': doc('Page', RAW) }, { allowRawHtml: true });
  try {
    assert.equal(b.r.status, 0, b.r.stderr);
    assert.ok(b.read('docs/page').includes('<iframe src="https://example.invalid/">'));
  } finally { b.done(); }
});

test('only the boolean true turns raw HTML on', () => {
  for (const v of ['true', 1, 'yes']) {
    const b = build({ '_index.md': doc('Home', 'home'), 'docs/_index.md': doc('Docs', 'x'), 'docs/page.md': doc('Page', RAW) }, { allowRawHtml: v });
    try { assert.ok(!b.read('docs/page').includes('<iframe src="https://example.invalid/">'), String(v)); } finally { b.done(); }
  }
});

test('NOTE and WARNING callouts keep their title and icon with raw HTML off', () => {
  const b = build({ '_index.md': doc('Home', 'home'), 'docs/_index.md': doc('Docs', 'x'),
    'docs/page.md': doc('Page', '> [!NOTE]\n> A **bold** note.\n\n> [!WARNING]\n> Careful.\n') });
  try {
    const html = b.read('docs/page');
    assert.match(html, /<blockquote class="alert alert-note">\s*<p><span class="alert-title"><span class="alert-icon"><svg[^>]*>.*?<\/svg><\/span>NOTE<\/span>\s*A <strong>bold<\/strong> note\.<\/p>/s);
    assert.match(html, /<blockquote class="alert alert-warning">\s*<p><span class="alert-title"><span class="alert-icon"><svg[^>]*>.*?<\/svg><\/span>WARNING<\/span>\s*Careful\.<\/p>/s);
  } finally { b.done(); }
});

test('a mermaid fence cannot inject HTML, whatever the setting', () => {
  const fence = '```mermaid\ngraph TD\nA --> B\n</pre><script>window.pwned3=1</script>\n```\n';
  for (const patch of [{}, { allowRawHtml: true }]) {
    const b = build({ '_index.md': doc('Home', 'home'), 'docs/_index.md': doc('Docs', 'x'), 'docs/page.md': doc('Page', fence) }, patch);
    try {
      const html = b.read('docs/page');
      assert.ok(!html.includes('<script>window.pwned3'));
      assert.ok(html.includes('A --&gt; B'));
    } finally { b.done(); }
  }
});
