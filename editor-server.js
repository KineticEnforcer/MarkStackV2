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

// =============================================================================
// Configuration
// =============================================================================

/** Server configuration constants */
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
  staticDir: path.join(__dirname, 'static')
};

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
  const page = fs.readFileSync(path.join(__dirname, 'editor.html'), 'utf-8').replace(/__CSP_NONCE__/g, nonce);
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
  const tree = scanDirectory(CONFIG.contentDir);
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
    
    if (!fs.existsSync(fullOldPath)) {
      return sendError(res, 404, 'Source not found');
    }
    
    if (fs.existsSync(fullNewPath)) {
      return sendError(res, 409, 'Target already exists');
    }
    
    fs.renameSync(fullOldPath, fullNewPath);
    
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
function handleAPI(req, res, pathname, url) {
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
  
  // API routes
  if (pathname.startsWith('/api/')) {
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
  if (pathname === '/' || pathname === '/editor' || pathname === '/editor.html') {
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

module.exports = { server, CONFIG, isInside, isPathSecure, checkRequestOrigin, start };
