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
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!this.data || typeof this.data.users !== 'object') throw new Error('Invalid user file');
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  _public(u) {
    return { name: u.name, role: u.role, sections: [...u.sections], disabled: !!u.disabled, mustChangePassword: !!u.mustChangePassword };
  }

  list() { return Object.values(this.data.users).map(u => this._public(u)); }
  get(name) { const u = this.data.users[name]; return u ? this._public(u) : null; }
  adminCount() { return Object.values(this.data.users).filter(u => u.role === 'admin' && !u.disabled).length; }

  async create({ name, role, password, sections = [], mustChangePassword = false }) {
    if (!NAME_RE.test(name || '')) throw new Error('Invalid user name');
    if (!ROLES.has(role)) throw new Error('Invalid role');
    if (this.data.users[name]) throw new Error('User already exists');
    const bad = checkPasswordPolicy(password);
    if (bad) throw new Error(bad);
    const secs = this._cleanSections(role, sections);
    this.data.users[name] = {
      name, role, sections: secs, disabled: false, mustChangePassword: !!mustChangePassword,
      passwordHash: await hashPassword(password, this.hashOpts), createdAt: new Date().toISOString(),
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
    this._save();
  }

  setDisabled(name, disabled) {
    const u = this._need(name);
    if (disabled && u.role === 'admin' && !u.disabled && this.adminCount() <= 1) throw new Error('Cannot disable the last administrator');
    u.disabled = !!disabled;
    this._save();
  }

  async setPassword(name, password, { mustChangePassword = false } = {}) {
    const u = this._need(name);
    const bad = checkPasswordPolicy(password);
    if (bad) throw new Error(bad);
    u.passwordHash = await hashPassword(password, this.hashOpts);
    u.mustChangePassword = !!mustChangePassword;
    this._save();
  }

  /** Returns the public user on success, otherwise null (same result for every failure). */
  async authenticate(name, password) {
    const u = this.data.users[name];
    if (!dummyHash) dummyHash = await hashPassword('not a real password', this.hashOpts);
    const ok = await verifyPassword(password, u ? u.passwordHash : dummyHash);
    if (!u || !ok || u.disabled) return null;
    return this._public(u);
  }

  _need(name) {
    const u = this.data.users[name];
    if (!u) throw new Error('No such user');
    return u;
  }
}

module.exports = { UserStore };
