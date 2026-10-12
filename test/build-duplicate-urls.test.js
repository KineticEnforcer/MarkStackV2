'use strict';
// Two content folders or pages that produce the same URL must fail the build
// instead of one silently replacing the other in dist/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function scratchSite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-dup-'));
  fs.copyFileSync(path.join(root, 'build.js'), path.join(dir, 'build.js'));
  fs.cpSync(path.join(root, 'lib'), path.join(dir, 'lib'), { recursive: true });
  for (const name of ['siteconfig.json', 'static', 'templates', 'template']) {
    const src = path.join(root, name);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, name), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(dir, 'content', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dir;
}

const page = (title, text) => `---\ntitle: ${title}\n---\n${text}\n`;

test('two folders with the same title fail the build and name both folders', () => {
  const dir = scratchSite({
    '_index.md': page('Home', 'home'),
    'marketing/_index.md': page('Marketing', 'a'),
    'marketing/news.md': page('News', 'marketing news'),
    'it/_index.md': page('Marketing', 'b'),
    'it/news.md': page('News', 'it news'),
  });
  try {
    const r = spawnSync(process.execPath, ['build.js'], { cwd: dir, encoding: 'utf-8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Duplicate URL/);
    assert.match(r.stderr, /marketing/);
    assert.match(r.stderr, /it/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a failed duplicate-URL build leaves the previous dist/ untouched', () => {
  const dir = scratchSite({
    '_index.md': page('Home', 'home'),
    'a.md': page('Same', 'one'),
    'b.md': page('Same', 'two'),
  });
  try {
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'keep.txt'), 'old');
    const r = spawnSync(process.execPath, ['build.js'], { cwd: dir, encoding: 'utf-8' });
    assert.notEqual(r.status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'dist', 'keep.txt'), 'utf-8'), 'old');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('distinct titles build normally', () => {
  const dir = scratchSite({
    '_index.md': page('Home', 'home'),
    'a/_index.md': page('Alpha', 'x'),
    'a/p.md': page('Page', 'one'),
    'b/_index.md': page('Beta', 'y'),
    'b/p.md': page('Page', 'two'),
  });
  try {
    const r = spawnSync(process.execPath, ['build.js'], { cwd: dir, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'alpha', 'page', 'index.html')));
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'beta', 'page', 'index.html')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sidebar respects section order and hidden metadata without omitting hidden output',()=>{
 const dir=scratchSite({'_index.md':page('Home','home'),'a/_index.md':'---\ntitle: Alpha\norder: 8\n---\n','b/_index.md':'---\ntitle: Beta\norder: 1\n---\n','c/_index.md':'---\ntitle: Concealed\nhidden: true\n---\n','c/p.md':page('Hidden page','body')});
 try{const r=spawnSync(process.execPath,['build.js'],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const html=fs.readFileSync(path.join(dir,'dist/index.html'),'utf8');assert.ok(html.indexOf('href="/beta/"')<html.indexOf('href="/alpha/"'));assert.ok(!html.includes('href="/concealed/"'));assert.ok(fs.existsSync(path.join(dir,'dist/concealed/hidden-page/index.html')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('runtime settings overlay configuration and escape text without enabling raw HTML',()=>{
 const dir=scratchSite({'_index.md':page('Home','<script>markdown-attack</script>'),'a.md':page('Safe','body')});try{
 const data=path.join(dir,'custom-data');fs.mkdirSync(data);fs.writeFileSync(path.join(data,'site-settings.json'),JSON.stringify({siteTitle:'<script>site-attack</script>',headerTitle:'" onclick="attack',siteSubtitle:'$& <img src=x onerror=attack>',allowRawHtml:true}));
 const r=spawnSync(process.execPath,['build.js','--data',data],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const html=fs.readFileSync(path.join(dir,'dist/index.html'),'utf8');assert.ok(html.includes('&lt;script&gt;site-attack'));assert.ok(!html.includes('<script>site-attack'));assert.ok(!html.includes('<script>markdown-attack'));assert.ok(html.includes('$&amp; &lt;img'));assert.ok(html.includes('&quot; onclick=&quot;attack'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('empty saved description and hidden hero remain empty/hidden in the build',()=>{
 const dir=scratchSite({'_index.md':page('Home','home body')});try{const data=path.join(dir,'data');fs.mkdirSync(data);fs.writeFileSync(path.join(data,'site-settings.json'),JSON.stringify({defaultDescription:'',showHero:false}));const r=spawnSync(process.execPath,['build.js','--data',data],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const html=fs.readFileSync(path.join(dir,'dist/index.html'),'utf8');assert.ok(!html.includes('class="homepage-hero"'));assert.ok(html.includes('name="description" content=""'));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
