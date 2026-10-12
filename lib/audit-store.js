"use strict";
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const MAX_BYTES = 1024 * 1024,
  MAX_ARCHIVES = 3;
/** Local append-only operational history, not tamper-proof. No free text or secrets. */
class AuditStore {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "audit.jsonl");
  }
  append({ event, actor = null, target = null, publish = null }) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(event))
      throw Error("Invalid audit event");
    const rec = {
      id: crypto.randomBytes(12).toString("hex"),
      at: new Date().toISOString(),
      event,
      actor: typeof actor === "string" ? actor.slice(0, 64) : null,
      target: typeof target === "string" ? target.slice(0, 200) : null,
    };
    if (publish)
      rec.publish = {
        id: String(publish.id).slice(0, 64),
        state: publish.state,
        startedAt: publish.startedAt,
        finishedAt: publish.finishedAt,
        pages: { done: publish.pages.done, total: publish.pages.total },
        failedStage: publish.failedStage || null,
      };
    fs.mkdirSync(this.dir, { recursive: true });
    if (fs.existsSync(this.file) && fs.statSync(this.file).size >= MAX_BYTES) {
      for (let i = MAX_ARCHIVES; i >= 1; i--) {
        const old = i === 1 ? this.file : this.file + "." + (i - 1),
          next = this.file + "." + i;
        if (i === MAX_ARCHIVES && fs.existsSync(next)) fs.unlinkSync(next);
        if (fs.existsSync(old)) fs.renameSync(old, next);
      }
    }
    fs.appendFileSync(this.file, JSON.stringify(rec) + "\n", { mode: 0o600 });
  }
  read({
    event = "",
    actor = "",
    target = "",
    before = "",
    limit = 50,
    publishes = false,
  } = {}) {
    limit = Math.max(1, Math.min(100, Number(limit) || 50));
    let records = [];
    for (let i = MAX_ARCHIVES; i >= 0; i--) {
      const f = this.file + (i ? "." + i : "");
      if (!fs.existsSync(f)) continue;
      for (const line of fs.readFileSync(f, "utf8").split("\n")) {
        if (!line) continue;
        try {
          const rec = JSON.parse(line);
          if (
            rec &&
            typeof rec === "object" &&
            typeof rec.id === "string" &&
            typeof rec.at === "string" &&
            typeof rec.event === "string"
          )
            records.push(rec);
        } catch {}
      }
    }
    records = records.reverse();
    if (before) {
      const pos = records.findIndex((r) => r.id === before);
      records = pos < 0 ? [] : records.slice(pos + 1);
    }
    records = records.filter(
      (r) =>
        (!event || r.event === event) &&
        (!actor || r.actor === actor) &&
        (!target || r.target === target) &&
        (!publishes || r.publish),
    );
    const rows = records.slice(0, limit);
    return {
      records: rows,
      hasMore: records.length > limit,
      nextBefore: rows.length ? rows[rows.length - 1].id : null,
    };
  }
}
module.exports = { AuditStore, MAX_BYTES, MAX_ARCHIVES };
