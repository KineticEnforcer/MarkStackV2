'use strict';
/**
 * In-memory sessions. The cookie carries a random token; only its SHA-256 hash
 * is kept, so a memory dump or log never holds a usable token. Each session has
 * its own CSRF token. Idle and absolute lifetimes are settings, not decisions
 * made here. Sessions end on restart, which is acceptable for a single-process
 * editor and avoids another file of secrets.
 */
const crypto = require('crypto');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

class SessionStore {
  constructor({ idleMs, maxMs, now = Date.now } = {}) {
    if (!(idleMs > 0) || !(maxMs > 0)) throw new Error('idleMs and maxMs are required');
    this.idleMs = idleMs; this.maxMs = maxMs; this.now = now;
    this.byHash = new Map();
  }

  create(userName) {
    const token = crypto.randomBytes(32).toString('base64url');
    const t = this.now();
    this.byHash.set(sha(token), { user: userName, csrf: crypto.randomBytes(24).toString('base64url'), created: t, last: t });
    return token;
  }

  /** Returns { user, csrf } for a live session and refreshes the idle timer, otherwise null. */
  get(token) {
    if (typeof token !== 'string' || token.length < 20) return null;
    const h = sha(token); const s = this.byHash.get(h);
    if (!s) return null;
    const t = this.now();
    if (t - s.last > this.idleMs || t - s.created > this.maxMs) { this.byHash.delete(h); return null; }
    s.last = t;
    return { user: s.user, csrf: s.csrf };
  }

  checkCsrf(token, header) {
    const s = this.get(token);
    return !!s && typeof header === 'string' && safeEqual(s.csrf, header);
  }

  destroy(token) { if (typeof token === 'string') this.byHash.delete(sha(token)); }

  /** End every session of one user (disable, password reset). Returns how many ended. */
  destroyUser(userName) {
    let n = 0;
    for (const [h, s] of this.byHash) if (s.user === userName) { this.byHash.delete(h); n++; }
    return n;
  }

  sweep() {
    const t = this.now();
    for (const [h, s] of this.byHash) if (t - s.last > this.idleMs || t - s.created > this.maxMs) this.byHash.delete(h);
  }
}

module.exports = { SessionStore };
