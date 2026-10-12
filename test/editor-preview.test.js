'use strict';
// Static guards for the preview boundary. Real script-execution checks run in a
// browser (see PR description); these keep the markup from regressing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf-8');

test('preview is a sandboxed iframe without allow-scripts', () => {
  const m = html.match(/<iframe id="preview-frame"[^>]*>/);
  assert.ok(m, 'preview iframe present');
  const sandbox = (m[0].match(/sandbox="([^"]*)"/) || [])[1];
  assert.ok(sandbox !== undefined, 'sandbox attribute present');
  const flags = sandbox.split(/\s+/).filter(Boolean);
  assert.ok(!flags.includes('allow-scripts'), 'must not allow scripts');
  assert.ok(!flags.includes('allow-top-navigation'), 'must not allow top navigation');
  assert.ok(!flags.includes('allow-popups'), 'must not allow popups');
});

test('rendered markdown is never written into the editor page itself', () => {
  assert.equal(/getElementById\('preview-output'\)/.test(html.replace(/doc\.getElementById\('preview-output'\)/g, '')), false);
  assert.equal(html.includes('<article class="preview-article" id="preview-output"></article>\n          </div>'), false);
});

test('mermaid fence content is escaped and mermaid runs in strict mode', () => {
  assert.ok(html.includes("md.utils.escapeHtml(str) + '</pre>'"));
  assert.ok((html.match(/securityLevel: 'strict'/g) || []).length >= 1);
});

test('preview frame carries a restrictive CSP', () => {
  assert.ok(html.includes("default-src \\'none\\'"));
});
