'use strict';
/**
 * Fetch a site's favicon on the server, safely. Used when an administrator
 * saves a link. The address comes from a form, so every request is treated as
 * hostile: only http/https on the default ports, the name must resolve only to
 * public addresses, the connection is pinned to the address that was checked
 * (no second DNS lookup), redirects are re-checked, and size, time and file
 * type are limited. SVG is refused (it can carry script).
 */
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');

const MAX_PAGE = 256 * 1024;
const MAX_ICON = 100 * 1024;
const MAX_REDIRECTS = 3;

function v4ToInt(ip) { return ip.split('.').reduce((a, b) => (a * 256) + Number(b), 0); }
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([a, bits]) => [v4ToInt(a), bits]);

/** True for any address a public web request must never reach. Unparseable input counts as blocked. */
function isBlockedAddress(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const n = v4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)));
  }
  if (kind === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^(?:::ffff:|::ffff:0:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    const hexMapped = s.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16), lo = parseInt(hexMapped[2], 16);
      return isBlockedAddress([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
    }
    if (s === '::' || s === '::1') return true;
    const first = parseInt(s.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true;       // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true;       // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true;       // multicast
    if (s.startsWith('2001:db8:') || s === '2001:db8::') return true;
    return false;
  }
  return true;
}

/** Parse an administrator-entered address. Throws a short message when it cannot be fetched safely. */
function parseWebUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new Error('Not a valid web address'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https addresses are allowed');
  if (u.username || u.password) throw new Error('Addresses with a user name or password are not allowed');
  if (!u.hostname) throw new Error('The address has no host name');
  if (u.port && u.port !== (u.protocol === 'https:' ? '443' : '80')) throw new Error('Only the standard web ports are allowed');
  return u;
}

async function resolvePublic(hostname, opts) {
  const lookup = opts.lookup || ((h) => dns.promises.lookup(h, { all: true, verbatim: true }));
  const host = hostname.replace(/^\[|\]$/g, '');
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host, family: net.isIP(host) }];
  else { try { addrs = await lookup(host); } catch { throw new Error('The host name did not resolve'); } }
  if (!addrs || !addrs.length) throw new Error('The host name did not resolve');
  if (!opts.allowPrivate && addrs.some(a => isBlockedAddress(a.address))) throw new Error('The address points to a private or reserved network');
  return addrs[0];
}

/** One request, pinned to a checked address. Resolves {status, headers, body}. */
async function request(u, opts, limit, accept) {
  const addr = await resolvePublic(u.hostname, opts);
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname.replace(/^\[|\]$/g, ''), port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: 'GET', timeout: opts.timeoutMs || 5000,
      headers: { 'User-Agent': 'MarkStack-favicon/1', Accept: accept, 'Accept-Encoding': 'identity' },
      lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: addr.address, family: addr.family }]) : cb(null, addr.address, addr.family))
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > limit) { req.destroy(new Error('Response too large')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** GET with at most MAX_REDIRECTS redirects; each hop is validated the same way. */
async function get(rawUrl, opts, limit, accept) {
  let u = parseWebUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await request(u, opts, limit, accept);
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.location) {
      u = parseWebUrl(new URL(r.headers.location, u).toString());
      continue;
    }
    return { ...r, url: u };
  }
  throw new Error('Too many redirects');
}

function sniff(buf) {
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'ico';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.slice(0, 6).toString('latin1'))) return 'gif';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function iconCandidates(html, base) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']?([^"'>]+)/i) || [])[1] || '';
    if (!/(^|\s)(shortcut\s+icon|icon|apple-touch-icon)(\s|$)/i.test(rel.trim())) continue;
    const href = (tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []);
    const h = href[1] || href[2] || href[3];
    if (!h) continue;
    try {
      const u = new URL(h.replace(/&amp;/g, '&'), base);
      if (u.protocol === 'http:' || u.protocol === 'https:') out.push(u.toString());
    } catch { /* skip */ }
  }
  return out;
}

/**
 * Find and download the icon for a site address.
 * @returns {Promise<{ext:string,data:Buffer,from:string}|null>} null when none was found
 * @throws only for an address that is refused; fetch problems give null
 */
async function fetchFavicon(siteUrl, opts = {}) {
  const site = parseWebUrl(siteUrl);
  await resolvePublic(site.hostname, opts);   // refuse a private target up front, with a clear reason
  const candidates = [];
  try {
    const page = await get(site.toString(), opts, MAX_PAGE, 'text/html');
    if (page.status === 200) candidates.push(...iconCandidates(page.body.toString('utf-8'), page.url.toString()));
    candidates.push(new URL('/favicon.ico', page.url).toString());
  } catch { candidates.push(new URL('/favicon.ico', site).toString()); }
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c) || seen.size >= 5) continue;
    seen.add(c);
    try {
      const r = await get(c, opts, MAX_ICON, 'image/*');
      if (r.status !== 200 || !r.body.length) continue;
      const ext = sniff(r.body);
      if (ext) return { ext, data: r.body, from: c };
    } catch { /* try the next candidate */ }
  }
  return null;
}

module.exports = { fetchFavicon, isBlockedAddress, parseWebUrl, sniff, iconCandidates };
