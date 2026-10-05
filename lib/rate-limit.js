'use strict';
/**
 * Failed-login limiter. Counts failures per key (an account name or a client
 * address) inside a sliding window and blocks the key for a while after too
 * many. A success clears the account key. Memory only; entries expire.
 */
class FailureLimiter {
  constructor({ maxFailures = 5, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000, now = Date.now } = {}) {
    Object.assign(this, { maxFailures, windowMs, blockMs, now });
    this.map = new Map();
  }
  _entry(key) {
    const t = this.now();
    let e = this.map.get(key);
    if (e && e.blockedUntil && t >= e.blockedUntil) { this.map.delete(key); e = null; }
    if (e && !e.blockedUntil && t - e.first > this.windowMs) { this.map.delete(key); e = null; }
    return e || null;
  }
  isBlocked(key) { const e = this._entry(key); return !!(e && e.blockedUntil && this.now() < e.blockedUntil); }
  fail(key) {
    const t = this.now();
    let e = this._entry(key);
    if (!e) { e = { count: 0, first: t, blockedUntil: 0 }; this.map.set(key, e); }
    e.count++;
    if (e.count >= this.maxFailures) e.blockedUntil = t + this.blockMs;
  }
  clear(key) { this.map.delete(key); }
}
module.exports = { FailureLimiter };
