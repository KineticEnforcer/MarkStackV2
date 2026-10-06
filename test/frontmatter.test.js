'use strict';
// Frontmatter must be plain YAML. Executable or alternate frontmatter languages
// are refused, so a content file can never run code when the site is built.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const parse = require('../lib/frontmatter');

const root = path.join(__dirname, '..');

test('YAML frontmatter and body are parsed', () => {
  const r = parse('---\ntitle: Hello\ntags: [a, b]\ndate: 2026-10-06\n---\n# Body\n');
  assert.equal(r.data.title, 'Hello');
  assert.deepEqual(r.data.tags, ['a', 'b']);
  assert.ok(r.data.date instanceof Date);
  assert.equal(r.content, '# Body\n');
});

test('explicit yaml, yml and a BOM are accepted; no frontmatter and empty input give empty data', () => {
  assert.equal(parse('---yaml\ntitle: A\n---\nx').data.title, 'A');
  assert.equal(parse('---YML\ntitle: B\n---\nx').data.title, 'B');
  assert.equal(parse('\ufeff---\ntitle: C\n---\nx').data.title, 'C');
  assert.deepEqual(parse('# just text').data, {});
  assert.deepEqual(parse('').data, {});
  assert.deepEqual(parse('---\n---\nbody').data, {});
});

test('a Buffer is read as UTF-8 text', () => {
  assert.equal(parse(Buffer.from('---\ntitle: Büro\n---\n')).data.title, 'Büro');
});

test('anchors and merge keys still work; YAML tags that run code are rejected', () => {
  assert.deepEqual(parse('---\nbase: &b {k: 1}\nuse: {<<: *b, z: 2}\n---\n').data.use, { k: 1, z: 2 });
  assert.throws(() => parse('---\nx: !!js/function "function(){}"\n---\n'));
});

test('executable and alternate frontmatter languages are refused', () => {
  globalThis.__frontmatterRan = false;
  const payload = '{ title: (globalThis.__frontmatterRan = true, "x") }';
  for (const lang of ['js', 'javascript', 'JS', 'JavaScript', ' js', 'js ', 'coffee', 'coffeescript', 'cson', 'json', 'toml', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    for (const eol of ['\n', '\r\n']) {
      assert.throws(() => parse(`---${lang}${eol}${payload}${eol}---${eol}body`), /Unsupported frontmatter language/, `lang "${lang}"`);
      assert.throws(() => parse(`\ufeff---${lang}${eol}${payload}${eol}---${eol}body`), /Unsupported frontmatter language/, `BOM lang "${lang}"`);
    }
  }
  assert.equal(globalThis.__frontmatterRan, false);
  delete globalThis.__frontmatterRan;
});

test('a ---js content file does not run code during a real build and the build fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-fm-'));
  const marker = path.join(dir, 'ran.txt');
  try {
    fs.copyFileSync(path.join(root, 'build.js'), path.join(dir, 'build.js'));
    fs.cpSync(path.join(root, 'lib'), path.join(dir, 'lib'), { recursive: true });
    for (const name of ['siteconfig.json', 'static', 'templates', 'template']) {
      const src = path.join(root, name);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, name), { recursive: true });
    }
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    fs.mkdirSync(path.join(dir, 'content'));
    fs.writeFileSync(path.join(dir, 'content', '_index.md'), '---\ntitle: Home\n---\nhome\n');
    fs.writeFileSync(
      path.join(dir, 'content', 'evil.md'),
      `---js\n{ title: (require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran'), 'x') }\n---\nbody\n`
    );
    const r = spawnSync(process.execPath, ['build.js'], { cwd: dir, encoding: 'utf-8' });
    assert.equal(fs.existsSync(marker), false, 'frontmatter code must not run');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /Unsupported frontmatter language/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('only YAML parsing is wired in: gray-matter is not used directly outside lib/frontmatter.js', () => {
  const offenders = [];
  const skip = new Set(['node_modules', 'dist', '.git']);
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && p !== __filename && !p.endsWith(path.join('lib', 'frontmatter.js'))) {
        if (/require\(['"]gray-matter['"]\)/.test(fs.readFileSync(p, 'utf-8'))) offenders.push(path.relative(root, p));
      }
    }
  })(root);
  assert.deepEqual(offenders, []);
});
