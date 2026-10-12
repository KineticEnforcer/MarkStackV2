'use strict';
// Local preview only. Production hosting remains the operator's choice.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
function createPreviewServer(directory) {
  const root = fs.realpathSync(directory);
  function inside(p) { const rel = path.relative(root, p); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
  return http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    function error(code, message) { res.writeHead(code, { 'Content-Type': 'text/plain' }); res.end(message); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return error(405, 'Method not allowed'); }
    let name;
    try { name = decodeURIComponent(req.url.split('?')[0]); } catch { return error(400, 'Invalid path'); }
    if (name.includes('\0') || name.includes('\\') || name.split('/').includes('..')) return error(403, 'Forbidden');
    let file = path.resolve(root, '.' + name);
    if (!inside(file)) return error(403, 'Forbidden');
    let status = 200;
    try {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      else if (!fs.existsSync(file) && !path.extname(file)) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { file = path.join(root, '404.html'); status = 404; }
      const real = fs.realpathSync(file);
      if (!inside(real)) return error(403, 'Forbidden');
      const stat = fs.statSync(real);
      if (!stat.isFile()) return error(404, 'Not found');
      const data = fs.readFileSync(real);
      res.writeHead(status, { 'Content-Type': TYPES[path.extname(real)] || 'application/octet-stream', 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { return error(404, 'Not found'); }
  });
}
if (require.main === module) {
  const port = Number(process.env.MARKSTACK_PREVIEW_PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MARKSTACK_PREVIEW_PORT must be 1-65535');
  const server = createPreviewServer(path.join(__dirname, '..', 'dist'));
  server.on('error', e => { console.error(e.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + port + ' (local only, no downloads)'));
}
module.exports = { createPreviewServer };
