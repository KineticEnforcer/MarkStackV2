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
    this._sync();
    if (this.data.users[name]) throw new Error('User already exists');
    this.data.users[name] = {
      name, role, sections: secs, disabled: false, mustChangePassword: !!mustChangePassword,
      passwordHash, authVersion: 0, createdAt: new Date().toISOString(),
    };
    this._save();
    return this._public(this.data.users[name]);
  }

  _cleanSections(role, sections) {
    if (role === 'admin') return [];
    if (!Array.isArray(sections) || sections.some(s => !SECTION_RE.test(s))) throw new Error('Invalid section name');
    return [...new Set(sections)];
  }

  setSections(name, sections) {
    const u = this._need(name);
    u.sections = this._cleanSections(u.role, sections);
    u.authVersion = (u.authVersion || 0) + 1;
    this._save();
  }

  setDisabled(name, disabled) {
    const u = this._need(name);
    if (disabled && u.role === 'admin' && !u.disabled && this.adminCount() <= 1) throw new Error('Cannot disable the last administrator');
    u.disabled = !!disabled;
    u.authVersion = (u.authVersion || 0) + 1;
    this._save();
  }

  async setPassword(name, password, { mustChangePassword = false } = {}) {
    this._need(name);
    const bad = checkPasswordPolicy(password);
    if (bad) throw new Error(bad);
    const passwordHash = await hashPassword(password, this.hashOpts);
    const u = this._need(name); // after the slow hash: reload and change the current record
    u.passwordHash = passwordHash;
    u.mustChangePassword = !!mustChangePassword;
    u.authVersion = (u.authVersion || 0) + 1;
    this._save();
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
