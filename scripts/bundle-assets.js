'use strict';
// Maintainer-only regeneration. Builds and normal use read committed local files.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const out = path.join(root, 'static/vendor');
async function main() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'fonts/files'), { recursive: true });
  let css = '';
  for (const [family, weights] of [['sans', [400, 500, 600, 700]], ['mono', [400, 500, 600]]]) {
    const pkg = path.dirname(require.resolve('@fontsource/ibm-plex-' + family + '/package.json'));
    for (const weight of weights) {
      const rules = fs.readFileSync(path.join(pkg, weight + '.css'), 'utf8').replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '');
      css += rules + '\n';
      for (const m of rules.matchAll(/url\(\.\/files\/([^)]*)\)/g)) fs.copyFileSync(path.join(pkg, 'files', m[1]), path.join(out, 'fonts/files', m[1]));
    }
  }
  fs.writeFileSync(path.join(out, 'fonts/fonts.css'), css);
  await esbuild.build({ entryPoints: [require.resolve('mermaid')], bundle: true, minify: true, format: 'iife', globalName: 'MarkStackMermaid', target: ['es2022'], outfile: path.join(out, 'mermaid.js'), legalComments: 'linked' });
  await esbuild.build({ stdin: { contents: "import hljs from 'highlight.js'; window.hljs = hljs;", resolveDir: root }, bundle: true, minify: true, format: 'iife', target: ['es2022'], outfile: path.join(out, 'highlight.js'), legalComments: 'linked' });
  const md = path.dirname(require.resolve('markdown-it/package.json'));
  fs.copyFileSync(path.join(md, 'dist/browser/markdown-it.umd.min.js'), path.join(out, 'markdown-it.js'));
  // Retain full package notices, including transitive library copyrights.
  const lock = require('../package-lock.json');
  let notices = '# Bundled asset notices\n\nIBM Plex fonts are unmodified, licensed under SIL OFL 1.1.\nMermaid and markdown-it are MIT; highlight.js is BSD-3-Clause.\n\n';
  const versions = {};
  for (const [p, info] of Object.entries(lock.packages)) {
    if (!p || !p.startsWith('node_modules/')) continue;
    versions[p] = info.version;
    const dir = path.join(root, p);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => /^(licen[sc]e|copying|notice)(\.|$)/i.test(f))) {
      if (fs.statSync(path.join(dir, f)).isFile()) notices += '\n## ' + p + '@' + info.version + ' / ' + f + '\n\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '\n';
    }
  }
  if (!/SIL OPEN FONT LICENSE/i.test(notices)) throw new Error('Font license notices missing; run npm ci with development dependencies');
  fs.writeFileSync(path.join(out, 'NOTICES.txt'), notices);
  const hashes = {};
  function walk(dir) { for (const f of fs.readdirSync(dir).sort()) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else hashes[path.relative(out, p).split(path.sep).join('/')] = require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }
  walk(out);
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ versions, sha256: hashes }, null, 2) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
