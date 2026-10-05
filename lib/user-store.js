'use strict';
/**
 * User accounts in one JSON file: name, role, assigned sections, password hash.
 * The file is written with owner-only permissions via a temp file and rename,
 * so a crash cannot leave half a file. Passwords are never stored or returned
 * in clear text, and listing users never returns hashes.
 */
const fs = require('fs');
const path = require('path');
const { hashPassword, verifyPassword, checkPasswordPolicy } = require('./passwords');

const ROLES = new Set(['admin', 'editor']);
const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const SECTION_RE = /^[a-z0-9][a-z0-9_-]*$/;
// Used to spend the same time when the user does not exist.
let dummyHash = null;

class UserStore {
  constructor(file, opts = {}) {
    this.file = file;
    this.hashOpts = opts.hashOpts;
    this.lockFile = `${file}.lock`;
    this.lockTimeoutMs = opts.lockTimeoutMs || 5000;
    this.lockStaleMs = opts.lockStaleMs || 30000;
    this.data = { users: {} };
    this.stamp = null;
    this._sync(true);
  }

  /**
   * Another process (the account commands run on the server) may have changed the
   * file. Before every read or change, reload it if its identity, size or time
   * moved, so a running editor sees the change and never writes stale data over it.
   */
  _sync(force = false) {
    let st = null;
    try { st = fs.statSync(this.file); } catch (e) { /* no file yet */ }
    const stamp = st ? `${st.ino}:${st.size}:${st.mtimeMs}` : 'none';
    if (!force && stamp === this.stamp) return;
    if (st) {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      if (!data || typeof data.users !== 'object') throw new Error('Invalid user file');
      this.data = data;
    } else {
      this.data = { users: {} };
    }
    this.stamp = stamp;
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    const st = fs.statSync(this.file);
    this.stamp = `${st.ino}:${st.size}:${st.mtimeMs}`;
  }

  /**
   * Cross-process lock for changes: an exclusive-create lock file holding the
   * owner's pid and time. A lock from a dead process that is older than the stale
   * time is taken over. If the lock cannot be taken in time the change fails
   * with an error and nothing is written (fail closed).
   */
  _lock() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const until = Date.now() + this.lockTimeoutMs;
    for (;;) {
      try {
        const fd = fs.openSync(this.lockFile, 'wx', 0o600);
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
        fs.closeSync(fd);
        return;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      this._breakStaleLock();
      if (Date.now() >= until) throw new Error('The user file is locked by another process; try again');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }

  _breakStaleLock() {
    try {
      const info = JSON.parse(fs.readFileSync(this.lockFile, 'utf-8'));
      let alive = true;
      try { process.kill(info.pid, 0); } catch (e) { alive = e.code === 'EPERM'; }
      if (!alive && Date.now() - info.at > this.lockStaleMs) fs.unlinkSync(this.lockFile);
    } catch (e) { /* unreadable or gone: the next attempt decides */ }
  }

  _unlock() { try { fs.unlinkSync(this.lockFile); } catch (e) { /* already gone */ } }

  /** Take the lock, read the current file, apply the change, save, release. */
  _tx(fn) {
    this._lock();
    try {
      this._sync(true);
      const result = fn();
      this._save();
      return result;
    } finally {
      this._unlock();
    }
  }

  _public(u) {
    return { name: u.name, role: u.role, sections: [...u.sections], disabled: !!u.disabled, mustChangePassword: !!u.mustChangePassword, authVersion: u.authVersion || 0 };
  }

  list() { this._sync(); return Object.values(this.data.users).map(u => this._public(u)); }
  get(name) { this._sync(); const u = this.data.users[name]; return u ? this._public(u) : null; }
  adminCount() { this._sync(); return Object.values(this.data.users).filter(u => u.role === 'admin' && !u.disabled).length; }

  async create({ name, role, password, sections = [], mustChangePassword = false }) {
    if (!NAME_RE.test(name || '')) throw new Error('Invalid user name');
    if (!ROLES.has(role)) throw new Error('Invalid role');
    const bad = checkPasswordPolicy(password);
    if (bad) throw new Error(bad);
    const secs = this._cleanSections(role, sections);
    const passwordHash = await hashPassword(password, this.hashOpts);
    return this._tx(() => {
      if (this.data.users[name]) throw new Error('User already exists');
      this.data.users[name] = {
        name, role, sections: secs, disabled: false, mustChangePassword: !!mustChangePassword,
        passwordHash, authVersion: 0, createdAt: new Date().toISOString(),
      };
      return this._public(this.data.users[name]);
    });
  }

  _cleanSections(role, sections) {
    if (role === 'admin') return [];
    if (!Array.isArray(sections) || sections.some(s => !SECTION_RE.test(s))) throw new Error('Invalid section name');
    return [...new Set(sections)];
  }

  setSections(name, sections) {
    this._tx(() => {
      const u = this._need(name);
      u.sections = this._cleanSections(u.role, sections);
      u.authVersion = (u.authVersion || 0) + 1;
    });
  }

  setDisabled(name, disabled) {
    this._tx(() => {
      const u = this._need(name);
      if (disabled && u.role === 'admin' && !u.disabled && this.adminCount() <= 1) throw new Error('Cannot disable the last administrator');
      u.disabled = !!disabled;
      u.authVersion = (u.authVersion || 0) + 1;
    });
  }

  async setPassword(name, password, { mustChangePassword = false, enable = false } = {}) {
    this._need(name);
    const bad = checkPasswordPolicy(password);
    if (bad) throw new Error(bad);
    const passwordHash = await hashPassword(password, this.hashOpts);
    this._tx(() => { // after the slow hash: under the lock, on the current file
      const u = this._need(name);
      u.passwordHash = passwordHash;
      u.mustChangePassword = !!mustChangePassword;
      if (enable) u.disabled = false;
      u.authVersion = (u.authVersion || 0) + 1;
    });
  }

  /** Returns the public user on success, otherwise null (same result for every failure). */
  async authenticate(name, password) {
    this._sync();
    const u = this.data.users[name];
    if (!dummyHash) dummyHash = await hashPassword('not a real password', this.hashOpts);
    const ok = await verifyPassword(password, u ? u.passwordHash : dummyHash);
    if (!u || !ok || u.disabled) return null;
    return this._public(u);
  }

  _need(name) {
    this._sync();
    const u = this.data.users[name];
    if (!u) throw new Error('No such user');
    return u;
  }
}

module.exports = { UserStore };
