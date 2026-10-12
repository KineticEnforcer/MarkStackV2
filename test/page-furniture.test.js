'use strict';
// Built pages carry the breadcrumb, the "On this page" rail and previous/next links.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function buildForTest(t) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'markstack-page-furniture-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  execFileSync(process.execPath, [path.join(root, 'build.js'), '--out', dist], { cwd: root, stdio: 'ignore' });
  return dist;
}

test('doc pages have breadcrumb, rail and prev/next; the homepage and 404 have no breadcrumb or prev/next and no hero banner styling', (t) => {
  const dist = buildForTest(t);
  const page = fs.readFileSync(path.join(dist, 'getting-started', 'quickstart', 'index.html'), 'utf-8');
  assert.match(page, /class="page-breadcrumb"/);
  assert.match(page, /class="toc-rail"/);
  assert.match(page, /class="prev-next"/);
  assert.match(page, /class="page-meta"/);
  // every rail link points at a heading that exists on the page
  for (const m of page.matchAll(/<li class="toc-item[^"]*"><a href="#([^"]+)"/g)) {
    assert.ok(page.includes(`id="${m[1]}"`), `rail link without heading: ${m[1]}`);
  }
  for (const file of ['index.html', '404.html']) {
    const html = fs.readFileSync(path.join(dist, file), 'utf-8');
    assert.doesNotMatch(html, /class="prev-next"/, file);
    assert.doesNotMatch(html, /class="page-breadcrumb"/, file);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(dist, '404.html'), 'utf-8'), /class="toc-rail"/);
  // the old fixed breadcrumb bar is gone and no editor link was added
  assert.doesNotMatch(page, /breadcrumb-bar/);
  assert.doesNotMatch(page, /editor\.html|\/editor/);
});

test('the sidebar position is settled by the inline script before the article, and the app.js fallback only scrolls a row that is really out of view', (t) => {
  const dist = buildForTest(t);
  const html = fs.readFileSync(path.join(dist, 'getting-started', 'quickstart', 'index.html'), 'utf-8');
  const script = html.indexOf('sidebar-scroll:');
  const into = html.indexOf('cb.top < sb.top || cb.bottom > sb.bottom');
  const article = html.indexOf('<main class="content">');
  assert.ok(script > 0 && into > script && into < article, 'restore and scroll-into-view run before the article');
  const app = fs.readFileSync(path.join(root, 'static', 'js', 'app.js'), 'utf-8');
  assert.match(app, /r\.top < box\.top \|\| r\.bottom > box\.bottom/);
  assert.doesNotMatch(app, /box\.top \+ 40|box\.bottom - 16/);
  // the marker has a start point even on a page with no current row
  assert.match(app, /translateY\(' \+ \(box\.top - 14\)/);
  // folders animate only after the saved state is applied, and the list stays hidden until then
  assert.match(html, /nav-ready/);
  assert.match(html, /nav-anim/);
  const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf-8');
  assert.match(css, /html\.nav-anim \.sidebar-children \{ transition: grid-template-rows/);
  assert.match(css, /html:not\(\.nav-ready\) \.sidebar-nav \{ visibility: hidden; \}/);
  assert.doesNotMatch(css, /\n\.sidebar-children \{[^}]*transition/);
});

test('web fonts never block the first paint, and the page has its own background and colour scheme before the stylesheets', (t) => {
  const dist = buildForTest(t);
  const html = fs.readFileSync(path.join(dist, 'getting-started', 'quickstart', 'index.html'), 'utf-8');
  const outsideNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  // no render-blocking fonts link and no inline event handler: the stylesheet is added by the head script
  assert.doesNotMatch(outsideNoscript, /<link[^>]+fonts\.googleapis\.com\/css2/);
  assert.doesNotMatch(html, /\sonload=/);
  assert.match(html, /fl\.href = '\/vendor\/fonts\/fonts\.css'/);
  assert.match(html, /<noscript><link[^>]+\/vendor\/fonts\/fonts\.css[^>]+rel="stylesheet"/);
  const main = html.indexOf('/css/main.css');
  for (const marker of ["cs.name = 'color-scheme'", 'fl.href =', ':where(html[data-theme="dark"])', ':where(html[data-theme="light"])']) {
    assert.ok(html.indexOf(marker) > 0 && html.indexOf(marker) < main, marker + ' comes before main.css');
  }
  const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf-8');
  assert.match(css, /html \{\n  background-color: var\(--color-bg-primary\);/);
});
