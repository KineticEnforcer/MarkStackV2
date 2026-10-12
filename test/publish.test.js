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
    templatesDir: path.join(ROOT, 'templates'), distDir, buildScript: path.join(ROOT, 'build.js'),
    stateFile: path.join(tmp, 'state', 'publish-state.json'), ...extra
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
  assert.deepEqual(fs.readdirSync(tmp).sort(), ['dist', 'dist.previous', 'state']);
  assert.match(s.live, /new build is now in the live folder/);
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

test('unpublished detection covers edits, new files, deletes, renames and config changes', async () => {
  const { tmp, p } = setup({ contentDir: null, staticDir: null, templatesDir: null });
  const content = path.join(tmp, 'content'); fs.mkdirSync(path.join(content, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(content, 'a.md'), '# a');
  fs.writeFileSync(path.join(content, 'sec', 'b.md'), '# b');
  const cfg = path.join(tmp, 'siteconfig.json'); fs.writeFileSync(cfg, '{"siteTitle":"x"}');
  p.o.contentDir = content; p.o.siteConfig = cfg;
  assert.equal(p.unpublished().unpublished, true, 'never published');
  p.start('admin1'); await p.finished();
  // this test's build script reads the real repo; record the state as a publish of THESE sources
  const fp = () => p.unpublished();
  fs.mkdirSync(path.dirname(p.o.stateFile), { recursive: true });
  const rec = () => fs.writeFileSync(p.o.stateFile, JSON.stringify({ fingerprint: p._fp(), publishedAt: 'x' }));
  p._fp = () => require('../lib/publish').fingerprintFor(p.sourceTargets());
  rec();
  assert.equal(fp().unpublished, false);
  const check = async (label, fn) => { fn(); assert.equal(fp().unpublished, true, label); rec(); assert.equal(fp().unpublished, false, label + ' recorded'); };
  await check('edit', () => fs.writeFileSync(path.join(content, 'a.md'), '# a changed, longer'));
  await check('new file', () => fs.writeFileSync(path.join(content, 'c.md'), '# c'));
  await check('delete', () => fs.rmSync(path.join(content, 'c.md')));
  await check('rename', () => fs.renameSync(path.join(content, 'sec', 'b.md'), path.join(content, 'sec', 'b2.md')));
  await check('move between folders', () => fs.renameSync(path.join(content, 'sec', 'b2.md'), path.join(content, 'b2.md')));
  await check('config', () => fs.writeFileSync(cfg, '{"siteTitle":"y"}'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('redaction removes secret-looking values', () => {
  const t = redact('token=abc123\nAuthorization: Bearer abcdefghijkl1234\nDB_PASSWORD="x y" ghp_' + 'a'.repeat(30) + '\nnormal line');
  assert.doesNotMatch(t, /abc123|abcdefghijkl1234|x y|ghp_/);
  assert.match(t, /normal line/);
});

function smallSite(tmp, pages) {
  const content = path.join(tmp, 'content'); fs.mkdirSync(content, { recursive: true });
  for (let i = 1; i <= pages; i++) fs.writeFileSync(path.join(content, 'p' + i + '.md'), '---\ntitle: Page ' + i + '\n---\n# Page ' + i + '\n');
  return content;
}

test('a save during the build cannot change the snapshot or tear the page count', async () => {
  const { tmp, distDir, p } = setup();
  p.o.contentDir = smallSite(tmp, 5);
  p.start('admin1');
  // the snapshot is already taken: changes after start() must not enter this build
  fs.writeFileSync(path.join(p.o.contentDir, 'p6.md'), '---\ntitle: Late\n---\n# Late\n');
  fs.writeFileSync(path.join(p.o.contentDir, 'p1.md'), '---\ntitle: Page 1 edited\n---\n# edited\n');
  await p.finished();
  const s = p.status();
  assert.equal(s.state, 'done', s.error);
  assert.deepEqual(s.pages, { done: 5, total: 5 });
  const allHtml = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? allHtml(path.join(d, e.name)) : e.name.endsWith('.html') ? [fs.readFileSync(path.join(d, e.name), 'utf-8')] : []).join('\n');
  const html1 = allHtml(distDir);
  assert.match(html1, /Page 1/);
  assert.doesNotMatch(html1, /Late|edited/);
  assert.equal(p.unpublished().unpublished, true, 'the late saves are still unpublished');
  p.start('admin1'); await p.finished();
  assert.equal(p.status().pages.total, 6);
  assert.match(allHtml(distDir), /Late/);
  assert.equal(p.unpublished().unpublished, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('if the second rename fails the old live site is put back and the old backup is untouched', async () => {
  const { tmp, distDir } = setup();
  const content = smallSite(tmp, 3);
  fs.mkdirSync(distDir + '.previous'); fs.writeFileSync(path.join(distDir + '.previous', 'index.html'), 'OLDER BACKUP');
  let calls = 0;
  const flaky = { ...fs, renameSync(a, b) { calls++; if (calls === 2) { const e = new Error('disk gremlin'); e.code = 'EIO'; throw e; } return fs.renameSync(a, b); } };
  const p = new Publisher({ root: ROOT, contentDir: content, staticDir: '', templatesDir: '', distDir, buildScript: path.join(ROOT, 'build.js'), stateFile: path.join(tmp, 'st.json'), fs: flaky });
  p.start('admin1'); await p.finished();
  const s = p.status();
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStage, 'Switching the live site');
  assert.match(s.live, /restored to the previous version/);
  assert.equal(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), 'OLD LIVE SITE');
  assert.equal(fs.readFileSync(path.join(distDir + '.previous', 'index.html'), 'utf-8'), 'OLDER BACKUP');
  assert.equal(fs.existsSync(path.join(tmp, 'st.json')), false, 'no publish recorded');
  assert.deepEqual(fs.readdirSync(tmp).filter(n => n.startsWith('dist')).sort(), ['dist', 'dist.previous']);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a failed publish keeps the existing dist.previous', async () => {
  const { tmp, distDir } = setup();
  fs.mkdirSync(distDir + '.previous'); fs.writeFileSync(path.join(distDir + '.previous', 'index.html'), 'OLDER BACKUP');
  const bad = path.join(tmp, 'bad.js'); fs.writeFileSync(bad, 'process.exit(3)');
  const p = new Publisher({ root: ROOT, contentDir: smallSite(tmp, 2), staticDir: '', templatesDir: '', distDir, buildScript: bad });
  p.start('admin1'); await p.finished();
  assert.equal(p.status().state, 'failed');
  assert.equal(fs.readFileSync(path.join(distDir + '.previous', 'index.html'), 'utf-8'), 'OLDER BACKUP');
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('site settings are snapshotted with a publish and late settings remain unpublished',async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'ms-settings-publish-'));
 const settings=path.join(data,'site-settings.json');fs.writeFileSync(settings,JSON.stringify({siteTitle:'Snapshot title'}));
 const {tmp,distDir,p}=setup({dataDir:data});try{p.start('admin');fs.writeFileSync(settings,JSON.stringify({siteTitle:'Late changed title'}));await p.finished();assert.equal(p.status().state,'done',p.status().error);const html=fs.readFileSync(path.join(distDir,'index.html'),'utf8');assert.ok(html.includes('Snapshot title'));assert.ok(!html.includes('Late changed title'));assert.equal(p.unpublished().unpublished,true);}finally{fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(data,{recursive:true,force:true});}
});
test('publish completion callback runs once for success and failure',async()=>{
 for(const fail of [false,true]){const seen=[],{tmp,p}=setup({onComplete:s=>seen.push(s),...(fail?{buildScript:'/nonexistent/build.js'}:{})});try{p.start('admin');await p.finished();assert.equal(seen.length,1);assert.equal(seen[0].state,fail?'failed':'done');assert.equal(seen[0].by,'admin');}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
});
