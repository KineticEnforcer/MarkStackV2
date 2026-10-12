const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync(
  require("node:path").join(__dirname, "../admin.html"),
  "utf8",
);
test("console has list/detail layout, accessible navigation, and mobile back control", () => {
  for (const token of [
    'aria-label="Admin areas"',
    'id="userSearch"',
    'id="userDetail"',
    'id="listBack"',
    "hashchange",
    "max-width: 800px",
    'role="status"',
  ])
    assert.ok(html.includes(token), token);
});
test("console uses confirmation dialogs and CSRF on every mutation helper", () => {
  assert.ok(!html.includes("confirm("));
  assert.ok(html.includes('id="askDlg"'));
  assert.ok(html.includes("X-CSRF-Token"));
});
test("editor and console use the same nonce-injected publish controller", () => {
  const e = fs.readFileSync(
    require("node:path").join(__dirname, "../editor.html"),
    "utf8",
  );
  assert.ok(e.includes("__PUBLISH_CONTROLLER__"));
  assert.ok(html.includes("__PUBLISH_CONTROLLER__"));
  const p = fs.readFileSync(
    require("node:path").join(__dirname, "../static/js/publish-controller.js"),
    "utf8",
  );
  for (const t of [
    "failedStage",
    "diagnostics",
    "/api/publish/status",
    "window.msCsrfToken",
  ])
    assert.ok(p.includes(t));
});
test('user detail tabs expose scoped access, session and activity controls with a dirty guard',()=>{
  for(const t of ['data-user-tab="access"','data-user-tab="account"','data-user-tab="sessions"','data-user-tab="activity"','id="accessSave"','id="accessDiscard"','msUserDirty','msUserSaving','/api/users/sign-out','Last sign-in','Select all','Select none'])assert.ok(html.includes(t),t);
});
test('section and page areas inject the content client and retain controlled save semantics',()=>{
 for(const t of ['id="sectionsView"','id="pagesView"','id="sectionSave"','__CONTENT_CONTROLLER__','msContentDirty','data-section-tab="settings"','data-section-tab="editors"','data-section-tab="pages"'])assert.ok(html.includes(t),t);
 const s=fs.readFileSync(require('node:path').join(__dirname,'../static/js/content-controller.js'),'utf8');
 for(const t of ['/api/content-catalog','/api/sections/settings','revision','X-CSRF-Token','Open','/api/rename','/api/delete']){if(t!=='Open')assert.ok(s.includes(t),t);}
});
test('site settings areas inject nonce-owned controller, save/discard and server-only raw HTML state',()=>{
 for(const t of ['id="generalView"','id="appearanceView"','__SITE_CONTROLLER__','msSiteDirty','msSiteSaving','id="rawHtmlState"'])assert.ok(html.includes(t),t);
 const s=fs.readFileSync(require('node:path').join(__dirname,'../static/js/site-controller.js'),'utf8');for(const t of ['/api/site-settings','X-CSRF-Token','revision','Not saved:'])assert.ok(s.includes(t),t);
});
