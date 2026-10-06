'use strict';
// Publish Changes: build beside the live site, check, then switch. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Publisher, redact } = require('../lib/publish');

const ROOT = path.join(__dirname, '..');
function setup(extra = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-publish-'));
  const distDir = path.join(tmp, 'dist');
  fs.mkdirSync(distDir);
  fs.writeFileSync(path.join(distDir, 'index.html'), 'OLD LIVE SITE');
  const p = new Publisher({
    root: ROOT, contentDir: path.join(ROOT, 'content'), staticDir: path.join(ROOT, 'static'),
    templatesDir: path.join(ROOT, 'templates'), distDir, buildScript: path.join(ROOT, 'build.js'), ...extra
  });
  return { tmp, distDir, p };
}

test('a good publish builds beside the live site, switches it in and keeps the previous version', async () => {
  const { tmp, distDir, p } = setup();
  p.start('admin1');
  assert.throws(() => p.start('admin1'), /already running/);
  await p.finished();
  const s = p.status();
  assert.equal(s.state, 'done', JSON.stringify(s.error));
  assert.ok(s.pages.total > 5 && s.pages.done === s.pages.total);
  assert.deepEqual(s.stages.map(x => x.state), ['done', 'done', 'done', 'done']);
  assert.match(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), /<html/);
  assert.equal(fs.readFileSync(path.join(distDir + '.previous', 'index.html'), 'utf-8'), 'OLD LIVE SITE');
  assert.equal(s.previous, 'dist.previous');
  assert.deepEqual(fs.readdirSync(tmp).sort(), ['dist', 'dist.previous']);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a failing build leaves the live site untouched and reports the stage, error and log', async () => {
  const { tmp, distDir } = setup();
  const bad = path.join(tmp, 'bad-build.js');
  fs.writeFileSync(bad, "console.log('✓ Generated: /a'); console.error('Error: broken template password=hunter2 in templates/base.html'); process.exit(1);");
  const p = new Publisher({ root: ROOT, contentDir: path.join(ROOT, 'content'), staticDir: '', templatesDir: '', distDir, buildScript: bad });
  p.start('admin1');
  await p.finished();
  const s = p.status();
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStage, 'Building the site');
  assert.match(s.error, /code 1/);
  assert.match(s.error, /broken template/);
  assert.doesNotMatch(JSON.stringify(s), /hunter2/);
  assert.match(s.live, /not changed/);
  assert.match(s.diagnostics, /Failed at: Building the site/);
  assert.equal(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), 'OLD LIVE SITE');
  assert.deepEqual(fs.readdirSync(tmp).sort(), ['bad-build.js', 'dist']);
  assert.deepEqual(s.stages.map(x => x.state), ['done', 'failed', 'pending', 'pending']);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('an incomplete build is rejected before the switch', async () => {
  const { tmp, distDir } = setup();
  const half = path.join(tmp, 'half-build.js');
  fs.writeFileSync(half, "const fs=require('fs');const o=process.argv[process.argv.indexOf('--out')+1];fs.mkdirSync(o,{recursive:true});fs.writeFileSync(o+'/index.html','x');");
  const p = new Publisher({ root: ROOT, contentDir: path.join(ROOT, 'content'), staticDir: '', templatesDir: '', distDir, buildScript: half });
  p.start('admin1');
  await p.finished();
  const s = p.status();
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStage, 'Checking the new build');
  assert.match(s.error, /missing 404.html/);
  assert.equal(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), 'OLD LIVE SITE');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('unpublished changes are detected from file times', () => {
  const { tmp, distDir, p } = setup({ contentDir: null, staticDir: null, templatesDir: null });
  const content = path.join(tmp, 'content'); fs.mkdirSync(content);
  fs.writeFileSync(path.join(content, 'a.md'), '# a');
  p.o.contentDir = content;
  const mid = new Date(Date.now() - 1800e3); fs.utimesSync(path.join(distDir, 'index.html'), mid, mid);
  const old = new Date(Date.now() - 3600e3);
  fs.utimesSync(path.join(content, 'a.md'), old, old); fs.utimesSync(content, old, old);
  assert.equal(p.unpublished().unpublished, false);
  fs.writeFileSync(path.join(content, 'a.md'), '# a changed');
  assert.equal(p.unpublished().unpublished, true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('redaction removes secret-looking values', () => {
  const t = redact('token=abc123\nAuthorization: Bearer abcdefghijkl1234\nDB_PASSWORD="x y" ghp_' + 'a'.repeat(30) + '\nnormal line');
  assert.doesNotMatch(t, /abc123|abcdefghijkl1234|x y|ghp_/);
  assert.match(t, /normal line/);
});
