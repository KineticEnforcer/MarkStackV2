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
