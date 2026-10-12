/**
 * MarkStack Editor - Development Server
 * 
 * A local HTTP server providing file management APIs for the MarkStack visual
 * markdown editor. Enables real-time content editing with live preview.
 * 
 * @module editor-server
 * @version 1.1.4
 * @author MarkStack Contributors
 * @license GPL-3.0
 * @see {@link https://github.com/markstack/markstack}
 */

'use strict';

// =============================================================================
// Dependencies
// =============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UserStore } = require('./lib/user-store');
const { SessionStore } = require('./lib/sessions');
const { FailureLimiter } = require('./lib/rate-limit');
const { authorize, filterTree, isValidSectionName } = require('./lib/section-access');
const { hashPassword, checkPasswordPolicy } = require('./lib/passwords');
const linksStore = require('./lib/links-store');
const favicon = require('./lib/favicon');
const contentCatalog = require('./lib/content-catalog');

// =============================================================================
// Configuration
// =============================================================================

/** Server configuration constants */
function normalizeIp(ip) {
  return String(ip || '').trim().replace(/^::ffff:/i, '').toLowerCase();
}
function parseTrustedProxies(v) {
  const out = [];
  for (const p of String(v || '').split(',').map(x => x.trim()).filter(Boolean)) {
    if (p.toLowerCase() === 'loopback') out.push('127.0.0.1', '::1'); else out.push(normalizeIp(p));
  }
  return out;
}

const CONFIG = {
  /** HTTP server port (MARKSTACK_EDITOR_PORT overrides) */
  port: parseInt(process.env.MARKSTACK_EDITOR_PORT, 10) || 3001,
  /**
   * Interface to bind. Defaults to loopback so the editor is not reachable
   * from the network. Set MARKSTACK_EDITOR_HOST explicitly to expose it.
   */
  host: process.env.MARKSTACK_EDITOR_HOST || '127.0.0.1',
  /** Extra Host header values to accept, comma separated (e.g. behind a proxy) */
  allowedHosts: (process.env.MARKSTACK_EDITOR_ALLOWED_HOSTS || '')
    .split(',').map(h => h.trim().toLowerCase()).filter(Boolean),
  /** Maximum JSON request body in bytes */
  maxBodyBytes: parseInt(process.env.MARKSTACK_EDITOR_MAX_BODY, 10) || 2 * 1024 * 1024,
  /** Path to content directory */
  contentDir: path.join(__dirname, 'content'),
  /** Path to static assets directory */
  staticDir: path.join(__dirname, 'static'),
  /** Folder the docs site is served from (Publish Changes replaces it) */
  distDir: path.join(__dirname, 'dist'),
  /** Users file (owner-only, git-ignored). MARKSTACK_USERS_FILE overrides. */
  usersFile: process.env.MARKSTACK_USERS_FILE || path.join(__dirname, '.markstack', 'users.json'),
  /** Session lifetimes in minutes (defaults are proposals pending review) */
  sessionIdleMinutes: parseInt(process.env.MARKSTACK_SESSION_IDLE_MINUTES, 10) || 8 * 60,
  sessionMaxMinutes: parseInt(process.env.MARKSTACK_SESSION_MAX_MINUTES, 10) || 7 * 24 * 60,
  /** Mark the session cookie Secure. Set to 1 when the site is served over HTTPS. */
  cookieSecure: process.env.MARKSTACK_EDITOR_COOKIE_SECURE === '1',
  /**
   * Addresses of reverse proxies allowed to tell the editor the client address
   * (comma separated IPs, or the word "loopback"). X-Forwarded-For is read only
   * when the connection itself comes from one of these; otherwise the header is
   * ignored, so a client cannot choose its own address. Empty = no proxy.
   */
  trustedProxies: parseTrustedProxies(process.env.MARKSTACK_TRUSTED_PROXIES)
};

/** Raw HTML in Markdown is allowed only when siteconfig.json says so (server-side file, not editable from the editor). */
function siteAllowsRawHtml() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'siteconfig.json'), 'utf-8')).allowRawHtml === true;
  } catch (e) { return false; }
}

/** MIME type mappings for static file serving */
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Recursively scan a directory and build a file tree structure.
 * 
 * @param {string} dirPath - Absolute path to the directory to scan
 * @param {string} [relativePath=''] - Relative path from content root (for recursion)
 * @returns {Array<Object>} Array of file/folder objects with name, path, type, and children
 * @example
 * // Returns:
 * // [
 * //   { name: 'getting-started', path: 'getting-started', type: 'folder', children: [...] },
 * //   { name: '_index.md', path: '_index.md', type: 'file' }
 * // ]
 */
function scanDirectory(dirPath, relativePath = '') {
  const items = [];
  
  if (!fs.existsSync(dirPath)) {
    return items;
  }
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // Separate and sort: folders first (alphabetical), then files (alphabetical)
  const folders = [];
  const files = [];
  
  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith('.')) continue;
    
    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const entryFullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      folders.push({
        name: entry.name,
        path: entryRelativePath,
        type: 'folder',
        children: scanDirectory(entryFullPath, entryRelativePath)
      });
    } else if (entry.name.endsWith('.md')) {
      files.push({
        name: entry.name,
        path: entryRelativePath,
        type: 'file'
      });
    }
  }
  
  // Sort alphabetically by name
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  
  return [...folders, ...files];
}

/**
 * Normalize a filename for consistency.
 * Converts spaces to dashes, removes special characters, and ensures .md extension.
 * 
 * @param {string} name - Original filename
 * @returns {string} Normalized filename with .md extension
 * @example
 * normalizeFilename('My New File');    // Returns: 'my-new-file.md'
 * normalizeFilename('test.md');        // Returns: 'test.md'
 * normalizeFilename('Hello World.md'); // Returns: 'hello-world.md'
 */
function normalizeFilename(name) {
  let normalized = name
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/[^a-z0-9\-_.]/g, '')  // Remove special chars except dash, underscore, dot
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .replace(/^-|-$/g, '');         // Remove leading/trailing dashes
  
  // Ensure .md extension
  if (!normalized.endsWith('.md')) {
    normalized += '.md';
  }
  
  return normalized;
}

/**
 * Normalize a folder name for consistency.
 * Converts spaces to dashes and removes special characters.
 * 
 * @param {string} name - Original folder name
 * @returns {string} Normalized folder name
 * @example
 * normalizeFolderName('My Category');  // Returns: 'my-category'
 * normalizeFolderName('Test Folder!'); // Returns: 'test-folder'
 */
function normalizeFolderName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/[^a-z0-9\-_]/g, '')   // Remove special chars except dash, underscore
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .replace(/^-|-$/g, '');         // Remove leading/trailing dashes
}

// =============================================================================
// Template Generators
// =============================================================================

/**
 * Generate frontmatter template for a new _index.md file.
 * 
 * @param {string} folderName - Name of the folder (used to derive title)
 * @returns {string} Markdown content with YAML frontmatter
 */
function createIndexTemplate(folderName) {
  const title = formatTitle(folderName);
  return `---
title: ${title}
description: Description for ${title}
---

# ${title}

Welcome to the ${title} section.
`;
}

/**
 * Generate frontmatter template for a new article file.
 * 
 * @param {string} fileName - Name of the file (used to derive title)
 * @returns {string} Markdown content with YAML frontmatter
 */
function createFileTemplate(fileName) {
  const title = formatTitle(fileName.replace('.md', ''));
  return `---
title: ${title}
description: Description for ${title}
---

# ${title}

Start writing your content here.
`;
}

/**
 * Convert a slug or filename into a human-readable title.
 * 
 * @param {string} slug - URL slug, filename, or folder name
 * @returns {string} Formatted title with proper capitalization
 * @example
 * formatTitle('my-new-article'); // Returns: 'My New Article'
 * formatTitle('getting_started'); // Returns: 'Getting Started'
 */
function formatTitle(slug) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * Validate that a path is within the content directory.
 * Prevents directory traversal attacks.
 * 
 * @param {string} fullPath - Absolute path to validate
 * @returns {boolean} True if path is within content directory
 */
function isPathSecure(fullPath) {
  return isInside(CONFIG.contentDir, fullPath);
}

/**
 * True when target is base itself or a path below it. Uses path.relative so a
 * sibling such as "content-evil" does not pass a prefix check, and resolves
 * symlinks on the deepest existing ancestor so a link inside content/ cannot
 * lead outside it.
 */
function isInside(base, target) {
  const resolvedTarget = path.resolve(target);
  const lexical = path.relative(path.resolve(base), resolvedTarget);
  if (lexical.startsWith('..') || path.isAbsolute(lexical)) return false;
  let probe = resolvedTarget;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return false;
    probe = parent;
  }
  let realBase, realProbe;
  try {
    realBase = fs.realpathSync(base);
    realProbe = fs.realpathSync(probe);
  } catch (e) {
    return false;
  }
  const real = path.relative(realBase, realProbe);
  return !(real.startsWith('..') || path.isAbsolute(real));
}

/** True when the path is the content root itself (never delete/rename it). */
function isContentRoot(fullPath) {
  return path.resolve(fullPath) === path.resolve(CONFIG.contentDir);
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

/** Reject non-strings and NUL bytes in user supplied relative paths. */
function isValidRelPath(p) {
  return typeof p === 'string' && p.length > 0 && !p.includes('\0');
}

// =============================================================================
// HTTP Response Helpers
// =============================================================================

/**
 * Send a JSON response with appropriate headers.
 * 
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Data to serialize as JSON
 */
/** Headers added to every response. CSP is added separately with the preview fix. */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

/** Pinned third-party scripts the editor page may load (integrity hashes must match editor.html). */
const EDITOR_SCRIPT_HASHES = [
  'sha384-wjfDDhOPPdjtva8vWBhWeVprSpmxisEu5aYT3q1JyACqXpdKpo3PWZTMVq24MBix',
  'sha384-EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2'
];

/** Content-Security-Policy for the editor page. Inline scripts need the per-response nonce. */
function editorCsp(nonce) {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' ${EDITOR_SCRIPT_HASHES.map(h => `'${h}'`).join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: http: https:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join('; ');
}

/** Serve editor.html with a fresh nonce and its CSP header. */
function serveEditorPage(res) {
  const nonce = require('crypto').randomBytes(16).toString('base64');
  const page = fs.readFileSync(path.join(__dirname, 'editor.html'), 'utf-8').replace(/__CSP_NONCE__/g, nonce).replace(/__ALLOW_RAW_HTML__/g, siteAllowsRawHtml() ? 'true' : 'false').replace('__PUBLISH_CONTROLLER__', () => fs.readFileSync(path.join(__dirname, 'static/js/publish-controller.js'), 'utf-8')).replace('__CONTENT_CONTROLLER__', () => fs.readFileSync(path.join(__dirname, 'static/js/content-controller.js'), 'utf-8'));
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Content-Security-Policy': editorCsp(nonce),
    ...SECURITY_HEADERS
  });
  res.end(page);
}

/** Host header values accepted for this server (DNS rebinding defence). */
function allowedHostValues() {
  const p = CONFIG.port;
  return new Set([
    `localhost:${p}`, `127.0.0.1:${p}`, `[::1]:${p}`,
    ...CONFIG.allowedHosts
  ]);
}

/**
 * Reject requests that did not come from this editor page. Checks the Host
 * header against an allow-list, requires Origin (when sent) to match Host,
 * and requires JSON content type on POST so cross-site "simple" requests
 * (text/plain forms) cannot write. Returns null when OK.
 */
function checkRequestOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  if (!allowedHostValues().has(host)) {
    return { status: 403, message: 'Host not allowed' };
  }
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let originHost;
    try { originHost = new URL(origin).host.toLowerCase(); } catch (e) { originHost = null; }
    if (originHost !== host) {
      return { status: 403, message: 'Cross-origin request blocked' };
    }
  }
  if (req.method === 'POST') {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      return { status: 415, message: 'Content-Type must be application/json' };
    }
  }
  return null;
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

/**
 * Send an error response.
 * 
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, { error: message });
}

/**
 * Send a success response.
 * 
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} [data={}] - Additional data to include in response
 */
function sendSuccess(res, data = {}) {
  sendJSON(res, 200, { success: true, ...data });
}

// =============================================================================
// API Request Body Parser
// =============================================================================

/**
 * Parse JSON request body.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @returns {Promise<Object>} Parsed JSON body
 */
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > CONFIG.maxBodyBytes) {
        failed = true;
        const err = new Error('Request body too large');
        err.status = 413;
        req.resume();
        return reject(err);
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (err) {
        const e = new Error('Invalid JSON');
        e.status = 400;
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/** Map a caught error to a response without leaking internals. */
function sendFailure(res, err) {
  if (err && err.status) return sendError(res, err.status, err.message);
  console.error('Editor error:', err);
  return sendError(res, 500, 'Internal server error');
}

// =============================================================================
// API Route Handlers
// =============================================================================

/**
 * Handle GET /api/tree - Return file tree structure.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
function handleGetTree(req, res) {
  const tree = filterTree(req.user, scanDirectory(CONFIG.contentDir));
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...SECURITY_HEADERS
  });
  res.end(JSON.stringify(tree));
}

/**
 * Handle GET /api/file - Read file content.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 * @param {URL} url - Parsed URL object
 */
function handleGetFile(req, res, url) {
  const filePath = url.searchParams.get('path');
  
  if (!isValidRelPath(filePath)) {
    return sendError(res, 400, 'Missing path parameter');
  }
  
  const fullPath = path.join(CONFIG.contentDir, filePath);
  
  // Security: ensure path is within content directory
  if (!isPathSecure(fullPath)) {
    return sendError(res, 403, 'Access denied');
  }
  if (!allowed(req, res, 'read', filePath)) return;
  
  if (!fs.existsSync(fullPath)) {
    return sendError(res, 404, 'File not found');
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  sendJSON(res, 200, { content });
}

/**
 * Handle POST /api/file - Save file content.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
async function handleSaveFile(req, res) {
  try {
    const { path: filePath, content } = await parseJSONBody(req);
    
    if (!isValidRelPath(filePath) || typeof content !== 'string') {
      return sendError(res, 400, 'Invalid path or content');
    }
    
    const fullPath = path.join(CONFIG.contentDir, filePath);
    
    // Security check
    if (!isPathSecure(fullPath)) {
      return sendError(res, 403, 'Access denied');
    }
    if (!allowed(req, res, 'write', filePath)) return;
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    
    sendSuccess(res);
  } catch (err) {
    sendFailure(res, err);
  }
}

/**
 * Handle POST /api/create-folder - Create new folder with _index.md.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
async function handleCreateFolder(req, res) {
  try {
    const { parentPath, name } = await parseJSONBody(req);
    if (parentPath !== undefined && parentPath !== '' && !isValidRelPath(parentPath)) {
      return sendError(res, 400, 'Invalid parent path');
    }
    const folderName = normalizeFolderName(name);
    
    if (!folderName) {
      return sendError(res, 400, 'Invalid folder name');
    }
    
    const folderPath = parentPath ? path.join(parentPath, folderName) : folderName;
    const fullPath = path.join(CONFIG.contentDir, folderPath);
    
    // Security check
    if (!isPathSecure(fullPath)) {
      return sendError(res, 403, 'Access denied');
    }
    if (!allowed(req, res, 'create', folderPath)) return;
    if (parentPath && !isDirectory(path.join(CONFIG.contentDir, parentPath))) {
      return sendError(res, 404, 'Parent folder not found');
    }
    
    if (fs.existsSync(fullPath)) {
      return sendError(res, 409, 'Folder already exists');
    }
    
    // Create folder and _index.md
    fs.mkdirSync(fullPath, { recursive: true });
    const indexPath = path.join(fullPath, '_index.md');
    fs.writeFileSync(indexPath, createIndexTemplate(folderName), 'utf-8');
    
    sendSuccess(res, { path: folderPath });
  } catch (err) {
    sendFailure(res, err);
  }
}

/**
 * Handle POST /api/create-file - Create new markdown file.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
async function handleCreateFile(req, res) {
  try {
    const { parentPath, name } = await parseJSONBody(req);
    if (parentPath !== undefined && parentPath !== '' && !isValidRelPath(parentPath)) {
      return sendError(res, 400, 'Invalid parent path');
    }
    const fileName = normalizeFilename(name);
    
    if (!fileName) {
      return sendError(res, 400, 'Invalid file name');
    }
    
    const filePath = parentPath ? path.join(parentPath, fileName) : fileName;
    const fullPath = path.join(CONFIG.contentDir, filePath);
    
    // Security check
    if (!isPathSecure(fullPath)) {
      return sendError(res, 403, 'Access denied');
    }
    if (!allowed(req, res, 'create', filePath)) return;
    if (parentPath && !isDirectory(path.join(CONFIG.contentDir, parentPath))) {
      return sendError(res, 404, 'Parent folder not found');
    }
    
    if (fs.existsSync(fullPath)) {
      return sendError(res, 409, 'File already exists');
    }
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, createFileTemplate(fileName), 'utf-8');
    
    sendSuccess(res, { path: filePath });
  } catch (err) {
    sendFailure(res, err);
  }
}

/**
 * Handle POST /api/rename - Rename file or folder.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
async function handleRename(req, res) {
  try {
    const { oldPath, newName, isFolder } = await parseJSONBody(req);
    
    if (!isValidRelPath(oldPath) || typeof newName !== 'string') {
      return sendError(res, 400, 'Invalid rename request');
    }
    const normalizedName = isFolder ? normalizeFolderName(newName) : normalizeFilename(newName);
    const parentDir = path.dirname(oldPath);
    const newPath = parentDir === '.' ? normalizedName : path.join(parentDir, normalizedName);
    
    const fullOldPath = path.join(CONFIG.contentDir, oldPath);
    const fullNewPath = path.join(CONFIG.contentDir, newPath);
    
    // Security check
    if (isContentRoot(fullOldPath) || !isPathSecure(fullOldPath) || !isPathSecure(fullNewPath)) {
      return sendError(res, 403, 'Access denied');
    }
    if (!allowed(req, res, 'rename', oldPath, newPath)) return;
    
    if (!fs.existsSync(fullOldPath)) {
      return sendError(res, 404, 'Source not found');
    }
    
    if (fs.existsSync(fullNewPath)) {
      return sendError(res, 409, 'Target already exists');
    }
    
    const topSection = isDirectory(fullOldPath) && path.dirname(oldPath) === '.';
    if (topSection && (!isValidSectionName(normalizedName) || !isDirectory(fullOldPath))) return sendError(res, 400, 'Invalid section rename');
    fs.renameSync(fullOldPath, fullNewPath);
    if (topSection) {
      try {
        const changed = AUTH.users.renameSection(oldPath, newPath);
        changed.forEach(name => AUTH.sessions.destroyUser(name));
        authLog('section-renamed', oldPath);
      } catch (err) { fs.renameSync(fullNewPath, fullOldPath); throw err; }
    }
    sendSuccess(res, { newPath });
  } catch (err) {
    sendFailure(res, err);
  }
}

/**
 * Handle DELETE /api/delete - Delete file or folder.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 * @param {URL} url - Parsed URL object
 */
function handleDelete(req, res, url) {
  const filePath = url.searchParams.get('path');
  
  if (!isValidRelPath(filePath)) {
    return sendError(res, 400, 'Missing path parameter');
  }
  
  const fullPath = path.join(CONFIG.contentDir, filePath);
  
  // Security check; the content root itself can never be deleted
  if (isContentRoot(fullPath) || !isPathSecure(fullPath)) {
    return sendError(res, 403, 'Access denied');
  }
  if (!allowed(req, res, 'delete', filePath)) return;
  
  if (!fs.existsSync(fullPath)) {
    return sendError(res, 404, 'Not found');
  }
  
  try {
    fs.rmSync(fullPath, { recursive: true });  // symlinks are removed, not followed
    sendSuccess(res);
  } catch (err) {
    sendFailure(res, err);
  }
}


// =============================================================================
// Authentication, sessions and user management
// =============================================================================

const SESSION_COOKIE = 'ms_session';
const SECURE_SESSION_COOKIE = '__Host-ms_session';

/**
 * Cookie name in use. Over HTTPS (cookieSecure) the "__Host-" prefix makes the
 * browser refuse the cookie unless it is Secure, Path=/ and has no Domain, so
 * a sibling subdomain cannot plant or overwrite it with a Domain=parent cookie.
 * Browsers reject that prefix on plain HTTP, so plain-HTTP local use keeps the
 * unprefixed name.
 */
function sessionCookieName() { return CONFIG.cookieSecure ? SECURE_SESSION_COOKIE : SESSION_COOKIE; }
const AUTH = { users: null, sessions: null, byAccount: null, byAddress: null, byAccountAll: null, known: new Map(), recentEvents: [] };

/** Create the auth state. Tests and the CLI can pass their own stores. */
function initAuth(opts = {}) {
  AUTH.users = opts.users || new UserStore(CONFIG.usersFile);
  AUTH.sessions = opts.sessions || new SessionStore({
    idleMs: CONFIG.sessionIdleMinutes * 60 * 1000,
    maxMs: CONFIG.sessionMaxMinutes * 60 * 1000
  });
  // Failures are counted per account AND address together, so someone guessing
  // from one address cannot lock the real user out from another. A second,
  // larger limit per address stops one address from trying many accounts.
  AUTH.byAccount = opts.byAccount || new FailureLimiter({ maxFailures: 5 });
  AUTH.byAddress = opts.byAddress || new FailureLimiter({ maxFailures: 30 });
  // Guessing spread over many addresses: after 20 failures for one account in
  // 15 minutes, addresses that account has not signed in from are paused for it.
  // Addresses it has signed in from before stay allowed, so an attacker cannot
  // lock the real user out of their usual place.
  AUTH.byAccountAll = opts.byAccountAll || new FailureLimiter({ maxFailures: 20 });
  AUTH.known = new Map();
  AUTH.recentEvents = [];
}

/** Log an auth event. Never pass passwords, tokens or cookie values here. */
function authLog(event, name) {
  AUTH.recentEvents.push({ event, target: typeof name === 'string' ? name.slice(0, 40) : null, at: new Date().toISOString() });
  if (AUTH.recentEvents.length > 500) AUTH.recentEvents.shift();
  console.log(`[auth] ${new Date().toISOString()} ${event}${name ? ` user=${String(name).slice(0, 40)}` : ''}`);
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function sessionCookie(token, maxAgeSeconds) {
  const parts = [`${sessionCookieName()}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSeconds}`];
  if (CONFIG.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

/** Set-Cookie headers for a session cookie. Over HTTPS this also expires any old unprefixed cookie. */
function sessionCookieHeaders(token, maxAgeSeconds) {
  const out = [sessionCookie(token, maxAgeSeconds)];
  if (CONFIG.cookieSecure) out.push(`${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure`);
  return out;
}

/** Resolve the signed-in user for a request, or null. Sets req.session and req.user. */
function resolveSession(req) {
  const token = readCookie(req, sessionCookieName());
  const sess = token ? AUTH.sessions.get(token) : null;
  if (!sess) return null;
  const user = AUTH.users.get(sess.user);
  // A password, section or disabled change made by anyone (the admin screen or a
  // command run on the server) bumps authVersion and ends older sessions.
  if (!user || user.disabled || (sess.authVersion || 0) !== user.authVersion) { AUTH.sessions.destroy(token); return null; }
  req.sessionToken = token;
  req.session = sess;
  req.user = user;
  return user;
}

function clientAddress(req) {
  const peer = normalizeIp(req.socket && req.socket.remoteAddress) || 'unknown';
  const trusted = CONFIG.trustedProxies;
  if (!trusted.length || !trusted.includes(peer)) return peer;
  // The connection comes from our proxy. Walk X-Forwarded-For from the right,
  // skipping our own proxies; the first other address is the client.
  const parts = String(req.headers['x-forwarded-for'] || '').split(',').map(normalizeIp).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!trusted.includes(parts[i])) return parts[i].slice(0, 64);
  }
  return peer;
}

function sendJSONWithCookie(res, status, data, cookie) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': cookie, ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

function me(user, session) {
  return { user: { name: user.name, role: user.role, sections: user.sections, mustChangePassword: user.mustChangePassword }, csrf: session.csrf };
}

async function handleLogin(req, res) {
  try {
    const { name, password } = await parseJSONBody(req);
    const addr = clientAddress(req);
    if (typeof name !== 'string' || typeof password !== 'string') return sendError(res, 400, 'Invalid request');
    const acct = `acct:${name.toLowerCase().slice(0, 64)}|${addr}`;
    const nameKey = name.toLowerCase().slice(0, 64);
    const knownHere = (AUTH.known.get(nameKey) || []).includes(addr);
    if (AUTH.byAccount.isBlocked(acct) || AUTH.byAddress.isBlocked(`addr:${addr}`) ||
        (!knownHere && AUTH.byAccountAll.isBlocked(`all:${nameKey}`))) {
      authLog('login-blocked', name);
      return sendError(res, 429, 'Too many attempts. Try again later.');
    }
    const user = await AUTH.users.authenticate(name, password);
    if (!user) {
      AUTH.byAccount.fail(acct); AUTH.byAddress.fail(`addr:${addr}`); AUTH.byAccountAll.fail(`all:${nameKey}`);
      authLog('login-failed', name);
      return sendError(res, 401, 'Invalid username or password');
    }
    AUTH.byAccount.clear(acct);
    const seen = AUTH.known.get(user.name) || [];
    if (!seen.includes(addr)) { seen.push(addr); if (seen.length > 5) seen.shift(); AUTH.known.set(user.name, seen); }
    AUTH.users.recordLogin(user.name, user.authVersion);
    const token = AUTH.sessions.create(user.name, user.authVersion);
    authLog('login', user.name);
    sendJSONWithCookie(res, 200, me(user, AUTH.sessions.get(token)), sessionCookieHeaders(token, CONFIG.sessionMaxMinutes * 60));
  } catch (err) { sendFailure(res, err); }
}

function handleLogout(req, res) {
  AUTH.sessions.destroy(req.sessionToken);
  authLog('logout', req.user.name);
  sendJSONWithCookie(res, 200, { success: true }, sessionCookieHeaders('', 0));
}

async function handleChangePassword(req, res) {
  try {
    const { current, password } = await parseJSONBody(req);
    if (typeof current !== 'string' || typeof password !== 'string') return sendError(res, 400, 'Invalid request');
    if (!(await AUTH.users.authenticate(req.user.name, current))) return sendError(res, 403, 'Current password is wrong');
    if (password === current) return sendError(res, 400, 'Choose a different password');
    await AUTH.users.setPassword(req.user.name, password, { mustChangePassword: false });
    AUTH.sessions.destroyUser(req.user.name);
    const token = AUTH.sessions.create(req.user.name, AUTH.users.get(req.user.name).authVersion);
    authLog('password-changed', req.user.name);
    sendJSONWithCookie(res, 200, { success: true, ...me(AUTH.users.get(req.user.name), AUTH.sessions.get(token)) }, sessionCookieHeaders(token, CONFIG.sessionMaxMinutes * 60));
  } catch (err) { sendBadInput(res, err); }
}

/** Policy and validation errors from the user store are safe to show; others are not. */
function sendBadInput(res, err) {
  if (err && !err.status && /^(Invalid|Password|That password|User already|No such user|Cannot disable)/.test(err.message)) {
    return sendError(res, 400, err.message);
  }
  return sendFailure(res, err);
}

function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) out += alphabet[bytes[i] % alphabet.length];
  return out.replace(/(.{5})(?=.)/g, '$1-');
}

let publisher = null;
function getPublisher() {
  if (!publisher) {
    const { Publisher } = require('./lib/publish');
    publisher = new Publisher({
      root: __dirname, contentDir: CONFIG.contentDir, staticDir: CONFIG.staticDir,
      templatesDir: path.join(__dirname, 'templates'), distDir: CONFIG.distDir,
      buildScript: path.join(__dirname, 'build.js'), siteConfig: path.join(__dirname, 'siteconfig.json'),
      dataDir: path.dirname(CONFIG.usersFile),
      stateFile: path.join(path.dirname(CONFIG.usersFile), 'publish-state.json')
    });
  }
  return publisher;
}

/** Admin-only Publish Changes API. Returns true when the request was handled. */
function handlePublishAPI(req, res, pathname) {
  if (req.user.role !== 'admin') { sendError(res, 403, 'Administrator only'); return true; }
  if (req.method === 'GET' && pathname === '/api/publish/status') { sendJSON(res, 200, getPublisher().status()); return true; }
  if (req.method === 'POST' && pathname === '/api/publish') {
    try {
      const id = getPublisher().start(req.user.name);
      authLog('publish-started', req.user.name);
      sendSuccess(res, { id });
    } catch (err) {
      if (err.code === 'BUSY') sendError(res, 409, err.message); else sendFailure(res, err);
    }
    return true;
  }
  return false;
}


// =============================================================================
// Header links (administrator only)
// =============================================================================

/** Folder for runtime data (links.json, favicons). On a server it sits beside users.json, outside the repository. */
function dataDir() { return CONFIG.dataDir || path.dirname(CONFIG.usersFile); }

const MAX_ICON_FETCHES = 5;

/**
 * Save the whole list. The icon is fetched only for a new link, a changed
 * address, or an explicit refresh, a few per save. A failed fetch never blocks
 * saving the link: it shows the generic icon and the response says why.
 */
async function saveLinks(rawList) {
  const v = linksStore.validateList(rawList);
  if (v.error) { const e = new Error(v.error); e.status = 400; throw e; }
  const dir = dataDir();
  const old = new Map(linksStore.readLinks(dir).map(l => [l.id, l]));
  const refresh = new Set((Array.isArray(rawList) ? rawList : []).map((r, i) => (r && r.refresh === true ? i : -1)).filter(i => i >= 0));
  const fetcher = CONFIG.faviconFetcher || favicon.fetchFavicon;
  const notes = [];
  let fetches = 0;
  for (let i = 0; i < v.links.length; i++) {
    const l = v.links[i];
    const prev = old.get(l.id);
    const changed = !prev || prev.url !== l.url;
    if (!changed && !refresh.has(i)) { l.favicon = prev.favicon; continue; }
    // A changed address drops the old icon at once, so a failed fetch never leaves another site's icon. A plain refresh keeps the old icon if nothing new is found.
    l.favicon = changed ? '' : prev.favicon;
    if (fetches >= MAX_ICON_FETCHES) { notes.push({ id: l.id, title: l.title, icon: 'later', reason: 'Too many new icons in one save. Use Refresh icon on this link.' }); continue; }
    fetches++;
    try {
      const r = await fetcher(l.url);
      if (r) { l.favicon = linksStore.saveFavicon(dir, l.id, r.ext, r.data); notes.push({ id: l.id, title: l.title, icon: 'found' }); }
      else notes.push({ id: l.id, title: l.title, icon: 'none', reason: l.favicon ? 'No new icon found. The old icon is kept.' : 'No icon found. The generic icon is used.' });
    } catch (err) {
      notes.push({ id: l.id, title: l.title, icon: 'none', reason: 'Icon not fetched: ' + (err && err.message ? err.message : 'failed') + (l.favicon ? '. The old icon is kept.' : '. The generic icon is used.') });
    }
  }
  linksStore.writeLinks(dir, v.links);
  return { links: v.links, notes };
}

/** Admin-only links API and icon files. Returns true when handled. */
async function handleLinksAPI(req, res, pathname) {
  if (req.user.role !== 'admin') { sendError(res, 403, 'Administrator only'); return true; }
  try {
    if (req.method === 'GET' && pathname === '/api/links') { sendJSON(res, 200, { links: linksStore.readLinks(dataDir()), max: linksStore.MAX_LINKS, maxTitle: linksStore.MAX_TITLE }); return true; }
    if (req.method === 'POST' && pathname === '/api/links') {
      const body = await parseJSONBody(req);
      const out = await saveLinks(body && body.links);
      authLog('links-saved', req.user.name);
      sendSuccess(res, out); return true;
    }
    const m = pathname.match(/^\/api\/links\/icon\/([a-f0-9]{12}\.(?:png|ico|gif|jpg|webp))$/);
    if (req.method === 'GET' && m) {
      const f = path.join(dataDir(), 'favicons', m[1]);
      if (!fs.existsSync(f)) { sendError(res, 404, 'Not found'); return true; }
      const types = { png: 'image/png', ico: 'image/x-icon', gif: 'image/gif', jpg: 'image/jpeg', webp: 'image/webp' };
      res.writeHead(200, { 'Content-Type': types[m[1].split('.')[1]], 'Cache-Control': 'private, max-age=300', ...SECURITY_HEADERS });
      res.end(fs.readFileSync(f)); return true;
    }
  } catch (err) { sendBadInput(res, err); return true; }
  return false;
}

function listSections() {
  return scanDirectory(CONFIG.contentDir).filter(n => n.type === 'folder').map(n => n.name);
}

/** Admin-only user management API. Returns true when the request was handled. */
async function handleAdminAPI(req, res, pathname) {
  if (req.user.role !== 'admin') { sendError(res, 403, 'Administrator only'); return true; }
  try {
    if (req.method === 'GET' && pathname === '/api/users') { sendJSON(res, 200, { users: AUTH.users.list(), sections: listSections() }); return true; }
    if (req.method === 'GET' && pathname.startsWith('/api/users/')) {
      const name = decodeURIComponent(pathname.slice('/api/users/'.length));
      if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(name)) return sendError(res, 400, 'Invalid user name'), true;
      const user = AUTH.users.get(name);
      if (!user) return sendError(res, 404, 'No such user'), true;
      sendJSON(res, 200, { user, sessions: AUTH.sessions.summary(name, user.authVersion), activity: AUTH.recentEvents.filter(e => e.target === name).slice(-50).reverse() });
      return true;
    }
    if (req.method !== 'POST') return false;
    if (pathname === '/api/users/sign-out') {
      const { name } = await parseJSONBody(req);
      if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,31}$/.test(name) || !AUTH.users.get(name)) return sendError(res, 400, 'No such user'), true;
      AUTH.users.revokeSessions(name);
      const ended = AUTH.sessions.destroyUser(name);
      authLog('sessions-ended', name);
      sendSuccess(res, { ended, signedOut: name === req.user.name }); return true;
    }
  if (pathname === '/api/users') {
      const { name, role, password, sections } = await parseJSONBody(req);
      const u = await AUTH.users.create({ name, role, password, sections: sections || [] });
      authLog('user-created', name);
      sendSuccess(res, { user: u }); return true;
    }
    if (pathname === '/api/users/sections') {
      const { name, sections } = await parseJSONBody(req);
      AUTH.users.setSections(name, sections);
      AUTH.sessions.destroyUser(name);
      authLog('sections-changed', name);
      sendSuccess(res); return true;
    }
    if (pathname === '/api/users/disable') {
      const { name, disabled } = await parseJSONBody(req);
      if (name === req.user.name && disabled) return sendError(res, 400, 'You cannot disable your own account'), true;
      AUTH.users.setDisabled(name, !!disabled);
      if (disabled) AUTH.sessions.destroyUser(name);
      authLog(disabled ? 'user-disabled' : 'user-enabled', name);
      sendSuccess(res); return true;
    }
    if (pathname === '/api/users/reset-password') {
      const { name } = await parseJSONBody(req);
      const target = AUTH.users.get(name);
      if (!target) return sendError(res, 400, 'No such user'), true;
      if (target.role !== 'editor') return sendError(res, 400, 'Only editor accounts are reset here'), true;
      const temp = temporaryPassword();
      await AUTH.users.setPassword(name, temp, { mustChangePassword: true });
      AUTH.sessions.destroyUser(name);
      authLog('password-reset', name);
      sendSuccess(res, { temporaryPassword: temp }); return true;
    }
  } catch (err) { sendBadInput(res, err); return true; }
  return false;
}

/** Administrator-only content metadata. Existing file APIs still own create/rename/delete. */
async function handleContentAdminAPI(req, res, pathname) {
  if (req.user.role !== 'admin') return sendError(res, 403, 'Administrator only');
  try {
    if (req.method === 'GET' && pathname === '/api/content-catalog') return sendJSON(res, 200, contentCatalog.catalog(CONFIG.contentDir, AUTH.users.list()));
    if (req.method === 'POST' && pathname === '/api/sections/settings') {
      const data = await parseJSONBody(req);
      if (!isValidSectionName(data.name)) return sendError(res, 400, 'Invalid section name');
      const rel = data.name + '/_index.md', full = path.join(CONFIG.contentDir, rel);
      if (!allowed(req, res, 'write', rel)) return;
      if (!isDirectory(path.join(CONFIG.contentDir,data.name))) return sendError(res, 404, 'Section not found');
      const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
      if (typeof data.revision !== 'string' || contentCatalog.revision(text) !== data.revision) return sendError(res, 409, 'Section changed. Reload before saving.');
      const updated = contentCatalog.updateSection(text, data);
      const tmp = full + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
      try { fs.writeFileSync(tmp, updated, { mode: 0o600 }); fs.renameSync(tmp, full); } finally { if(fs.existsSync(tmp))fs.unlinkSync(tmp); }
      authLog('section-settings-saved', data.name);
      return sendSuccess(res, { revision: contentCatalog.revision(updated) });
    }
    return sendError(res, 404, 'Not found');
  } catch (err) { sendBadInput(res, err); }
}

/** Authorize a content action for the signed-in user; sends the error and returns false when denied. */
function allowed(req, res, action, relPath, newRelPath) {
  const d = authorize(req.user, action, relPath, { contentDir: CONFIG.contentDir, newRelPath });
  if (d.allow) return true;
  const messages = { 400: 'Invalid path', 401: 'Sign in required', 403: 'Access denied', 404: 'Not found' };
  sendError(res, d.status, messages[d.status] || 'Access denied');
  return false;
}

function servePublicPage(res, file) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const page = fs.readFileSync(path.join(__dirname, file), 'utf-8').replace(/__CSP_NONCE__/g, nonce).replace('__PUBLISH_CONTROLLER__', () => fs.readFileSync(path.join(__dirname, 'static/js/publish-controller.js'), 'utf-8')).replace('__CONTENT_CONTROLLER__', () => fs.readFileSync(path.join(__dirname, 'static/js/content-controller.js'), 'utf-8'));
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    ...SECURITY_HEADERS
  });
  res.end(page);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end();
}

// =============================================================================
// API Router
// =============================================================================

/**
 * Route API requests to appropriate handlers.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 * @param {string} pathname - Request pathname
 * @param {URL} url - Parsed URL object
 */
async function handleAPI(req, res, pathname, url) {
  if (pathname === '/api/content-catalog' || pathname === '/api/sections/settings') return handleContentAdminAPI(req, res, pathname);
  if (req.method === 'GET' && pathname === '/api/me') return sendJSON(res, 200, me(req.user, req.session));
  if (req.method === 'POST' && pathname === '/api/logout') return handleLogout(req, res);
  if (req.method === 'POST' && pathname === '/api/change-password') return handleChangePassword(req, res);
  if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
    if (await handleAdminAPI(req, res, pathname)) return;
  }

  if (pathname === '/api/links' || pathname.startsWith('/api/links/')) {
    if (await handleLinksAPI(req, res, pathname)) return;
  }

  if (pathname === '/api/publish' || pathname === '/api/publish/status') {
    if (handlePublishAPI(req, res, pathname)) return;
  }

  // GET /api/tree - File tree
  if (req.method === 'GET' && pathname === '/api/tree') {
    return handleGetTree(req, res);
  }
  
  // GET /api/file - Read file
  if (req.method === 'GET' && pathname === '/api/file') {
    return handleGetFile(req, res, url);
  }
  
  // POST /api/file - Save file
  if (req.method === 'POST' && pathname === '/api/file') {
    return handleSaveFile(req, res);
  }
  
  // POST /api/create-folder - Create folder
  if (req.method === 'POST' && pathname === '/api/create-folder') {
    return handleCreateFolder(req, res);
  }
  
  // POST /api/create-file - Create file
  if (req.method === 'POST' && pathname === '/api/create-file') {
    return handleCreateFile(req, res);
  }
  
  // POST /api/rename - Rename item
  if (req.method === 'POST' && pathname === '/api/rename') {
    return handleRename(req, res);
  }
  
  // DELETE /api/delete - Delete item
  if (req.method === 'DELETE' && pathname === '/api/delete') {
    return handleDelete(req, res, url);
  }
  
  // Unknown API endpoint
  sendError(res, 404, 'Not found');
}

// =============================================================================
// Static File Server
// =============================================================================

/**
 * Serve a static file with appropriate headers.
 * 
 * @param {http.ServerResponse} res - HTTP response object
 * @param {string} filePath - Absolute path to the file
 */
function serveStatic(res, filePath, root) {
  if (root && !isInside(root, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Not found');
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  const content = fs.readFileSync(filePath);
  
  // No caching for development
  res.writeHead(200, { 
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...SECURITY_HEADERS
  });
  res.end(content);
}

// =============================================================================
// Main Request Handler
// =============================================================================

/**
 * Main HTTP request handler.
 * Routes requests to API handlers or static file server.
 * 
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
function requestHandler(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  } catch (e) {
    return sendError(res, 400, 'Bad request');
  }
  const gate = checkRequestOrigin(req);
  if (gate) return sendError(res, gate.status, gate.message);
  const pathname = url.pathname;
  
  if (!AUTH.users) initAuth();

  // Public: the login page and the login call
  if (pathname === '/login' && req.method === 'GET') return servePublicPage(res, 'login.html');
  if (pathname === '/api/login' && req.method === 'POST') return handleLogin(req, res);

  // API routes: a session is required for every one of them
  if (pathname.startsWith('/api/')) {
    if (!resolveSession(req)) return sendError(res, 401, 'Sign in required');
    const mustChange = req.user.mustChangePassword && !['/api/me', '/api/logout', '/api/change-password'].includes(pathname);
    if (mustChange) return sendError(res, 403, 'Password change required');
    if (req.method !== 'GET' && !AUTH.sessions.checkCsrf(req.sessionToken, req.headers['x-csrf-token'])) {
      return sendError(res, 403, 'Invalid CSRF token');
    }
    return handleAPI(req, res, pathname, url);
  }
  
  // Static asset routes - serve from static directory
  if (pathname.startsWith('/static/')) {
    const staticPath = path.join(CONFIG.staticDir, pathname.replace('/static/', ''));
    return serveStatic(res, staticPath, CONFIG.staticDir);
  }
  
  // CSS files
  if (pathname.startsWith('/css/')) {
    const cssPath = path.join(CONFIG.staticDir, pathname);
    return serveStatic(res, cssPath, CONFIG.staticDir);
  }
  
  // JavaScript files
  if (pathname.startsWith('/js/')) {
    const jsPath = path.join(CONFIG.staticDir, pathname);
    return serveStatic(res, jsPath, CONFIG.staticDir);
  }
  
  // SVG files
  if (pathname.startsWith('/svg/')) {
    const svgPath = path.join(CONFIG.staticDir, pathname);
    return serveStatic(res, svgPath, CONFIG.staticDir);
  }
  
  // Editor HTML for root and common paths
  if (pathname === '/admin' || pathname === '/admin/users' || pathname === '/admin/links') {
    if (!resolveSession(req)) return redirect(res, '/login');
    if (req.user.role !== 'admin') return sendError(res, 403, 'Administrator only');
    if (pathname !== '/admin') return redirect(res, '/admin#/' + (pathname.endsWith('links') ? 'links' : 'users'));
    return servePublicPage(res, 'admin.html');
  }
  if (pathname === '/' || pathname === '/editor' || pathname === '/editor.html') {
    if (!resolveSession(req)) return redirect(res, '/login');
    return serveEditorPage(res);
  }

  // markdown-it browser build from the installed package (same version as the site build)
  if (pathname === '/vendor/markdown-it.js') {
    const p = require.resolve('markdown-it/package.json').replace(/package\.json$/, 'dist/browser/markdown-it.umd.min.js');
    return serveStatic(res, p);
  }
  
  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
  res.end('Not found');
}

// =============================================================================
// Server Initialization
// =============================================================================

const server = http.createServer(requestHandler);

function start() {
server.listen(CONFIG.port, CONFIG.host, () => {
  console.log('\n📝 MarkStack Editor Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✓ Editor running at: http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`✓ Content directory: ${CONFIG.contentDir}`);
  console.log('\nPress Ctrl+C to stop the server.\n');
});
}

if (require.main === module) {
  start();
}

module.exports = { server, CONFIG, getPublisher, AUTH, initAuth, isInside, isPathSecure, checkRequestOrigin, start };
