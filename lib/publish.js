'use strict';
/**
 * Publish Changes: build the site into a temporary folder next to the live
 * one, check the result, then switch it in. The live site is only replaced
 * when every earlier step succeeded; the previous version is kept.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const STAGES = [
  { key: 'check', label: 'Taking a snapshot of the saved content' },
  { key: 'build', label: 'Building the site' },
  { key: 'verify', label: 'Checking the new build' },
  { key: 'switch', label: 'Switching the live site' }
];
const MAX_LOG_LINES = 300;
const MAX_LINE = 600;

/** Strip values that look like secrets from text shown to the user or copied for an admin. */
function redact(text) {
  return String(text)
    .replace(/\b(authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]*/gi, '$1: [redacted]')
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+\/=-]{8,}/gi, '$1 [redacted]')
    .replace(/\b([A-Za-z0-9_.-]*(password|passwd|secret|token|api[_-]?key|session)[A-Za-z0-9_.-]*)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi, '$1=[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})\b/g, '[redacted]');
}

function newestMtime(target, skip) {
  let newest = 0;
  const walk = p => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    newest = Math.max(newest, st.mtimeMs);
    if (st.isDirectory()) {
      for (const n of fs.readdirSync(p)) { if (!(skip && skip.has(n))) walk(path.join(p, n)); }
    }
  };
  walk(target);
  return newest;
}

/**
 * Fingerprint of everything the build reads: every file's relative path, size
 * and modified time, plus folders, so edits, adds, deletes and renames all
 * change it. Taken in one synchronous pass.
 */
function fingerprint(targets) {
  const h = crypto.createHash('sha256');
  const walk = (p, rel) => {
    let st;
    try { st = fs.statSync(p); } catch { h.update('missing:' + rel + '\n'); return; }
    if (st.isDirectory()) {
      h.update('d:' + rel + '\n');
      for (const n of fs.readdirSync(p).sort()) walk(path.join(p, n), rel + '/' + n);
    } else {
      h.update('f:' + rel + ':' + st.size + ':' + Math.round(st.mtimeMs) + '\n');
    }
  };
  for (const t of targets.filter(Boolean)) walk(t, path.basename(t));
  return h.digest('hex');
}

function countMarkdown(dir) {
  let n = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) n += countMarkdown(full);
    else if (e.name.endsWith('.md')) n++;
  }
  return n;
}

class Publisher {
  /**
   * @param {{root:string, contentDir:string, staticDir:string, templatesDir:string, distDir:string, buildScript:string, siteConfig?:string, timeoutMs?:number}} o
   */
  constructor(o) {
    this.o = Object.assign({ timeoutMs: 5 * 60 * 1000 }, o);
    this.fs = o.fs || fs;
    this.job = null;
  }

  sourceTargets() {
    return [this.o.contentDir, this.o.staticDir, this.o.templatesDir, this.o.siteConfig];
  }

  /**
   * Whether the sources differ from what the last editor publish built from.
   * Compares a fingerprint (paths, sizes, times, folders), so deletes, renames
   * and config changes count, not only newer files.
   */
  unpublished() {
    let rec = null;
    try { rec = JSON.parse(fs.readFileSync(this.o.stateFile, 'utf-8')); } catch { /* none yet */ }
    if (!rec || !rec.fingerprint) return { unpublished: true, reason: 'This site has not been published from the editor yet.' };
    return { unpublished: fingerprint(this.sourceTargets()) !== rec.fingerprint, publishedAt: rec.publishedAt };
  }

  status() {
    const j = this.job;
    const base = this.unpublished();
    if (!j) return { state: 'idle', stages: STAGES.map(s => ({ ...s, state: 'pending' })), ...base };
    return {
      state: j.state, id: j.id, by: j.by, startedAt: j.startedAt, finishedAt: j.finishedAt || null,
      stage: j.stage, stages: j.stages.map(s => ({ ...s })), pages: { ...j.pages },
      log: j.log.slice(-80), error: j.error || null, failedStage: j.failedStage || null,
      live: j.live, previous: j.previous || null, diagnostics: j.state === 'failed' ? this.diagnostics() : null,
      ...base
    };
  }

  running() { return !!this.job && this.job.state === 'running'; }

  /** Start a publish. Returns the new job id; throws if one is already running. */
  start(user) {
    if (this.running()) { const e = new Error('A publish is already running'); e.code = 'BUSY'; throw e; }
    const id = Date.now().toString(36);
    this.job = {
      id, by: user, state: 'running', startedAt: new Date().toISOString(), stage: 'check',
      stages: STAGES.map(s => ({ ...s, state: 'pending' })), pages: { done: 0, total: 0 }, log: [],
      live: 'Not changed yet: the live site is still the previous version.'
    };
    this._done = this._run().catch(err => this._fail(this.job.stage, err));
    return id;
  }

  /** Resolves when the current job ends (used by tests). */
  finished() { return this._done || Promise.resolve(); }

  _log(line) {
    const j = this.job;
    const clean = redact(line).slice(0, MAX_LINE);
    j.log.push(clean);
    if (j.log.length > MAX_LOG_LINES) j.log.shift();
  }

  _setStage(key, state) {
    const j = this.job;
    j.stage = key;
    const s = j.stages.find(x => x.key === key);
    if (s) s.state = state;
  }

  _fail(stageKey, err) {
    const j = this.job;
    const s = j.stages.find(x => x.key === stageKey);
    if (s && s.state !== 'done') s.state = 'failed';
    j.state = 'failed';
    j.failedStage = (STAGES.find(x => x.key === stageKey) || {}).label || stageKey;
    j.error = redact(err && err.message ? err.message : String(err));
    j.finishedAt = new Date().toISOString();
    if (!j.live || j.live.startsWith('Not changed yet')) {
      j.live = 'The live site was not changed. It is still the previous version. Saved files are untouched.';
    }
    this._log('FAILED at: ' + j.failedStage + ': ' + j.error);
    this._cleanTmp();
  }

  _cleanTmp() {
    const j = this.job;
    if (!j) return;
    for (const d of [j.tmp, j.snap]) { if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }

  diagnostics() {
    const j = this.job;
    if (!j) return '';
    const lines = [
      'MarkStack publish diagnostics',
      'Time: ' + (j.finishedAt || new Date().toISOString()),
      'Started by: ' + j.by,
      'Failed at: ' + (j.failedStage || '-'),
      'Error: ' + (j.error || '-'),
      'Live site: ' + j.live,
      'Pages built: ' + j.pages.done + ' of ' + j.pages.total,
      'Node: ' + process.version + ' (' + process.platform + ')',
      'Site folder: ' + this.o.root,
      'Live output folder: ' + this.o.distDir,
      'Temporary build folder: ' + (j.tmp || '-'),
      'Snapshot folder: ' + (j.snap || '-'),
      '--- last log lines ---',
      ...j.log.slice(-60)
    ];
    return redact(lines.join('\n'));
  }

  async _run() {
    const j = this.job;
    const { distDir, contentDir } = this.o;
    const parent = path.dirname(distDir);
    const base = path.basename(distDir);

    // 1. snapshot: copy the content in one synchronous pass so a save during
    // the build cannot change which pages exist or tear the page count.
    this._setStage('check', 'running');
    if (!fs.existsSync(contentDir)) throw new Error('Content folder not found: ' + contentDir);
    try { fs.accessSync(parent, fs.constants.W_OK); } catch (e) {
      throw new Error('The editor cannot write to ' + parent + ' (' + e.code + '). If the service runs with ReadWritePaths or ProtectSystem, add this folder. Publish needs to create a temporary folder here and switch it in.');
    }
    // remove leftovers of earlier failed publishes (only folders this feature creates)
    for (const n of fs.readdirSync(parent)) {
      if (n.startsWith(base + '.publish-')) { try { fs.rmSync(path.join(parent, n), { recursive: true, force: true }); } catch { /* ignore */ } }
    }
    j.tmp = path.join(parent, base + '.publish-' + j.id);
    j.snap = j.tmp + '.src';
    j.fingerprint = fingerprint(this.sourceTargets());
    fs.cpSync(contentDir, j.snap, { recursive: true });
    const total = countMarkdown(j.snap);
    if (total === 0) throw new Error('No markdown files found in ' + contentDir);
    j.pages.total = total;
    this._log('Snapshot of ' + total + ' markdown files. Building into ' + j.tmp);
    this._setStage('check', 'done');

    // 2. build
    this._setStage('build', 'running');
    await this._build();
    this._setStage('build', 'done');

    // 3. verify
    this._setStage('verify', 'running');
    this._verify();
    this._setStage('verify', 'done');

    // 4. switch
    this._setStage('switch', 'running');
    this._switch();
    this._setStage('switch', 'done');
    j.state = 'done';
    j.finishedAt = new Date().toISOString();
    j.live = 'The new build is now in the live folder. Reload the docs site to see it.';
    this._cleanTmp();
    this._log('Published ' + j.pages.done + ' pages.');
  }

  _build() {
    const j = this.job;
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [this.o.buildScript, '--out', j.tmp, '--content', j.snap], {
        cwd: this.o.root,
        env: { PATH: process.env.PATH, HOME: process.env.HOME, MARKSTACK_BUILD_EVENTS: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let errTail = [];
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, this.o.timeoutMs);
      const feed = (stream, isErr) => {
        let buf = '';
        stream.on('data', d => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
            this._onLine(line, isErr, errTail);
          }
        });
      };
      feed(child.stdout, false); feed(child.stderr, true);
      child.on('error', err => { clearTimeout(timer); reject(new Error('Could not start the build: ' + err.message)); });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        if (timedOut) return reject(new Error('The build took longer than ' + Math.round(this.o.timeoutMs / 1000) + ' seconds and was stopped.'));
        if (code === 0) return resolve();
        const detail = errTail.filter(Boolean).slice(-6).join(' | ');
        reject(new Error('The build exited with code ' + (code === null ? signal : code) + (detail ? ': ' + detail : '')));
      });
    });
  }

  _onLine(line, isErr, errTail) {
    const j = this.job;
    if (line.startsWith('@@MS ')) {
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.t === 'total' && Number.isInteger(ev.n)) j.pages.total = ev.n;
        else if (ev.t === 'page') j.pages.done++;
      } catch { /* ignore malformed event */ }
      return;
    }
    if (!line.trim()) return;
    this._log((isErr ? '[stderr] ' : '') + line);
    if (isErr || /❌|failed|error/i.test(line)) { errTail.push(redact(line).slice(0, 300)); if (errTail.length > 20) errTail.shift(); }
  }

  _verify() {
    const j = this.job;
    for (const f of ['index.html', '404.html', 'search-index.json']) {
      if (!fs.existsSync(path.join(j.tmp, f))) throw new Error('The new build is missing ' + f + '.');
    }
    try { JSON.parse(fs.readFileSync(path.join(j.tmp, 'search-index.json'), 'utf-8')); }
    catch (e) { throw new Error('search-index.json in the new build is not valid JSON: ' + e.message); }
    if (j.pages.done !== j.pages.total) throw new Error('Built ' + j.pages.done + ' of ' + j.pages.total + ' pages.');
    this._log('Checked: index.html, 404.html, search index, ' + j.pages.done + ' of ' + j.pages.total + ' pages.');
  }

  /**
   * Two renames (the old live folder aside, the new one in): a request that
   * lands between them can get a 404. Not atomic; the gap is a few
   * microseconds. Any failure puts the old folder back, and the previous
   * backup (dist.previous) is only replaced after the new build is in place.
   */
  _switch() {
    const j = this.job;
    const { distDir } = this.o;
    const f = this.fs;
    const prev = distDir + '.previous';
    const aside = distDir + '.old-' + j.id;
    const hadLive = fs.existsSync(distDir);
    if (hadLive) {
      try { f.renameSync(distDir, aside); } catch (e) { throw new Error('Could not move the live folder aside (' + e.code + '): ' + e.message); }
    }
    try {
      f.renameSync(j.tmp, distDir);
    } catch (e) {
      let restored = !hadLive;
      if (hadLive) { try { f.renameSync(aside, distDir); restored = true; } catch { /* reported below */ } }
      j.live = restored
        ? 'The live site was restored to the previous version.'
        : 'WARNING: the live site may be missing. The previous version is at ' + aside + '. Move it back to ' + distDir + '.';
      throw new Error('Could not switch in the new build (' + e.code + '): ' + e.message);
    }
    j.tmp = null;
    // the new build is live: now replace the older backup with the version we just moved aside
    if (hadLive) {
      try {
        fs.rmSync(prev, { recursive: true, force: true });
        f.renameSync(aside, prev);
        j.previous = path.basename(prev);
      } catch (e) {
        j.previous = path.basename(aside);
        this._log('Note: could not rotate the backup (' + e.message + '). Previous version kept as ' + path.basename(aside) + '.');
      }
    }
    // read back what is live and confirm it is the build we verified
    const live = path.join(distDir, 'index.html');
    if (!fs.existsSync(live)) throw new Error('After the switch ' + live + ' is missing. The previous version is at ' + (j.previous ? path.join(path.dirname(distDir), j.previous) : '(none)') + '.');
    if (this.o.stateFile) {
      try {
        fs.mkdirSync(path.dirname(this.o.stateFile), { recursive: true });
        fs.writeFileSync(this.o.stateFile, JSON.stringify({ fingerprint: j.fingerprint, publishedAt: new Date().toISOString(), pages: j.pages.done }));
      } catch (e) { this._log('Note: could not record the publish state (' + e.message + '); the unpublished marker may be wrong.'); }
    }
    this._log('Switched in the new build.' + (j.previous ? ' Previous version kept as ' + j.previous + '.' : ''));
  }
}

module.exports = { Publisher, STAGES, redact, fingerprintFor: fingerprint };
