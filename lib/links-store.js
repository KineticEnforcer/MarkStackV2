'use strict';
/**
 * Header links: a short list the administrator edits at /admin/links.
 * Stored in the data folder (beside users.json), never in the repository, so a
 * code update or folder swap keeps it. Every read validates again, because the
 * build and the editor must both survive a damaged or hand-edited file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_LINKS = 30;
const MAX_TITLE = 40;
const MAX_URL = 2000;
const ID_RE = /^[a-f0-9]{12}$/;
const FAVICON_RE = /^[a-f0-9]{12}\.(png|ico|gif|jpg|webp)$/;
const FILE = 'links.json';

function newId() { return crypto.randomBytes(6).toString('hex'); }

function cleanUrl(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s || s.length > MAX_URL) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  return u.toString();
}

/** Check one entry from untrusted input. Returns {link} or {error}. */
function validateLink(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Not a link' };
  const title = typeof raw.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) return { error: 'Every link needs a title' };
  if (title.length > MAX_TITLE) return { error: 'A title can be at most ' + MAX_TITLE + ' characters' };
  const url = cleanUrl(raw.url);
  if (!url) return { error: 'The address for "' + title + '" must be a full http or https address' };
  const id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : null;
  const favicon = typeof raw.favicon === 'string' && FAVICON_RE.test(raw.favicon) ? raw.favicon : '';
  return { link: { id, title, url, show: raw.show !== false, favicon } };
}

/** Validate a whole list from the editor. Returns {links} or {error}. */
function validateList(list) {
  if (!Array.isArray(list)) return { error: 'Links must be a list' };
  if (list.length > MAX_LINKS) return { error: 'At most ' + MAX_LINKS + ' links' };
  const out = [];
  const used = new Set();
  for (const raw of list) {
    const r = validateLink(raw);
    if (r.error) return { error: r.error };
    if (r.link.id && used.has(r.link.id)) r.link.id = null;
    r.link.id = r.link.id || newId();
    while (used.has(r.link.id)) r.link.id = newId();
    used.add(r.link.id);
    out.push(r.link);
  }
  return { links: out };
}

/** Read the stored list. Never throws: a missing or damaged file gives an empty list. Bad entries are skipped. */
function readLinks(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dataDir, FILE), 'utf-8'));
    if (!j || !Array.isArray(j.links)) return [];
    const out = [];
    for (const raw of j.links.slice(0, MAX_LINKS)) {
      const r = validateLink(raw);
      if (r.link && r.link.id) out.push(r.link);
    }
    return out;
  } catch { return []; }
}

function writeAtomic(file, data) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, data, { mode: 0o640 });
  fs.renameSync(tmp, file);
}

/** Save the list and delete icon files no link refers to any more. */
function writeLinks(dataDir, links) {
  fs.mkdirSync(dataDir, { recursive: true });
  writeAtomic(path.join(dataDir, FILE), JSON.stringify({ version: 1, links }, null, 2) + '\n');
  const dir = path.join(dataDir, 'favicons');
  if (fs.existsSync(dir)) {
    const keep = new Set(links.map(l => l.favicon).filter(Boolean));
    for (const f of fs.readdirSync(dir)) if (FAVICON_RE.test(f) && !keep.has(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ } }
  }
}

function saveFavicon(dataDir, id, ext, data) {
  const dir = path.join(dataDir, 'favicons');
  fs.mkdirSync(dir, { recursive: true });
  const name = id + '.' + ext;
  if (!FAVICON_RE.test(name)) throw new Error('bad icon name');
  writeAtomic(path.join(dir, name), data);
  return name;
}

module.exports = { MAX_LINKS, MAX_TITLE, FAVICON_RE, ID_RE, validateLink, validateList, readLinks, writeLinks, saveFavicon, cleanUrl };
