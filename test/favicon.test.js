'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { fetchFavicon, isBlockedAddress, parseWebUrl, sniff } = require('../lib/favicon');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

function serve(handler) {
  return new Promise(resolve => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
  });
}
// the guard allows only port 80/443, so tests map any host to the local test server
const local = (port) => ({ allowPrivate: true, lookup: async () => [{ address: '127.0.0.1', family: 4 }], _port: port });

test('blocked addresses cover private, loopback, link-local, mapped and malformed input', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'nonsense']) {
    assert.strictEqual(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111']) assert.strictEqual(isBlockedAddress(ip), false, ip);
});

test('addresses: only http/https, standard ports, no credentials', () => {
  for (const u of ['ftp://a.com', 'file:///etc/passwd', 'javascript:alert(1)', 'http://a.com:8080', 'http://u:p@a.com', 'nope', '']) {
    assert.throws(() => parseWebUrl(u), u);
  }
  assert.ok(parseWebUrl('https://example.com/x?y=1'));
});

test('file type is decided by the bytes, not by the name or header; SVG and HTML are refused', () => {
  assert.strictEqual(sniff(PNG), 'png');
  assert.strictEqual(sniff(Buffer.from([0, 0, 1, 0, 1, 0])), 'ico');
  assert.strictEqual(sniff(Buffer.from('GIF89a....')), 'gif');
  assert.strictEqual(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.strictEqual(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'webp');
  assert.strictEqual(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.strictEqual(sniff(Buffer.from('<html>')), null);
});

test('a private target is refused before any request is made', async () => {
  let hits = 0;
  const { s, port } = await serve((q, r) => { hits++; r.end('x'); });
  try {
    await assert.rejects(fetchFavicon('http://internal.example/', { lookup: async () => [{ address: '127.0.0.1', family: 4 }] }), /private or reserved/);
    await assert.rejects(fetchFavicon('http://127.0.0.1/'), /private or reserved/);
    await assert.rejects(fetchFavicon('http://[::1]/'), /private or reserved/);
    await assert.rejects(fetchFavicon('http://metadata.example/', { lookup: async () => [{ address: '8.8.8.8', family: 4 }, { address: '169.254.169.254', family: 4 }] }), /private or reserved/);
    assert.strictEqual(hits, 0);
  } finally { s.close(); }
});

// The server only listens on one random port; point the guard at it by rewriting the port through a tiny shim.
function withPort(port) {
  const realRequest = http.request;
  http.request = (o, cb) => realRequest({ ...o, port }, cb);
  return () => { http.request = realRequest; };
}

test('finds the icon named in the page, and falls back to /favicon.ico', async () => {
  const { s, port } = await serve((q, r) => {
    if (q.url === '/') { r.setHeader('content-type', 'text/html'); r.end('<html><head><link rel="shortcut icon" href="/assets/i.png"></head></html>'); }
    else if (q.url === '/assets/i.png') r.end(PNG);
    else { r.statusCode = 404; r.end(); }
  });
  const undo = withPort(port);
  try {
    const r = await fetchFavicon('http://example.test/', local(port));
    assert.strictEqual(r.ext, 'png'); assert.ok(r.data.equals(PNG)); assert.match(r.from, /\/assets\/i\.png$/);
  } finally { undo(); s.close(); }
  const b = await serve((q, r) => { if (q.url === '/favicon.ico') r.end(Buffer.from([0, 0, 1, 0, 1, 0, 0, 0])); else { r.statusCode = 404; r.end(); } });
  const undo2 = withPort(b.port);
  try {
    const r = await fetchFavicon('http://example.test/', local(b.port));
    assert.strictEqual(r.ext, 'ico');
  } finally { undo2(); b.s.close(); }
});

test('returns null when there is no usable icon (HTML served as an icon, SVG, or 404)', async () => {
  const { s, port } = await serve((q, r) => {
    if (q.url === '/') { r.end('<link rel="icon" href="/x.svg"><link rel="icon" href="/y.png">'); }
    else if (q.url === '/x.svg') r.end('<svg onload="alert(1)"></svg>');
    else if (q.url === '/y.png') r.end('<html>not an image</html>');
    else { r.statusCode = 404; r.end(); }
  });
  const undo = withPort(port);
  try { assert.strictEqual(await fetchFavicon('http://example.test/', local(port)), null); } finally { undo(); s.close(); }
});

test('an oversized icon is refused', async () => {
  const big = Buffer.concat([PNG, Buffer.alloc(200 * 1024, 2)]);
  const { s, port } = await serve((q, r) => { if (q.url === '/') r.end('<link rel="icon" href="/big.png">'); else if (q.url === '/big.png') r.end(big); else { r.statusCode = 404; r.end(); } });
  const undo = withPort(port);
  try { assert.strictEqual(await fetchFavicon('http://example.test/', local(port)), null); } finally { undo(); s.close(); }
});

test('redirects are followed at most 3 times and each hop is re-checked', async () => {
  let n = 0;
  const { s, port } = await serve((q, r) => { n++; r.statusCode = 302; r.setHeader('location', '/r' + n); r.end(); });
  const undo = withPort(port);
  try { assert.strictEqual(await fetchFavicon('http://example.test/', local(port)), null); assert.ok(n <= 12, 'bounded: ' + n); } finally { undo(); s.close(); }
  // a redirect to a private host is refused when guarding is on (no real network: the request is faked)
  const { EventEmitter } = require('node:events');
  const seen = [];
  const realRequest = http.request;
  http.request = (o, cb) => {
    seen.push(o.hostname + ' -> ' + o.lookup.length);
    const req = new EventEmitter(); req.destroy = () => {};
    req.end = () => { const res = new EventEmitter(); res.statusCode = 302; res.headers = { location: 'http://localhost/secret' }; cb(res); res.emit('end'); };
    return req;
  };
  const lookup = async (h) => (h === 'evil.test' ? [{ address: '8.8.8.8', family: 4 }] : [{ address: '127.0.0.1', family: 4 }]);
  try {
    assert.strictEqual(await fetchFavicon('http://evil.test/', { lookup }), null);
    assert.ok(seen.every(x => x.startsWith('evil.test')), 'no request was made to the private redirect target: ' + seen.join(', '));
  } finally { http.request = realRequest; }
});
