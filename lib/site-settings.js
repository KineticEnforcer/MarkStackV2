"use strict";
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const FILE = "site-settings.json";
const limits = {
  siteTitle: 120,
  headerTitle: 80,
  siteSubtitle: 300,
  defaultDescription: 300,
  siteUrl: 2000,
};
const defaults = {
  siteTitle: "Knowledge Base",
  headerTitle: "Knowledge Base",
  siteSubtitle: "",
  defaultDescription: "Documentation and knowledge base",
  siteUrl: "",
  showHero: true,
};
function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid settings object");
  const out = {};
  for (const key of Object.keys(limits))
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "string" || input[key].length > limits[key])
        throw Error(
          "Invalid " + key + ": maximum " + limits[key] + " characters",
        );
      out[key] = input[key].trim();
      if ((key === "siteTitle" || key === "headerTitle") && !out[key])
        throw Error("Invalid " + key + ": cannot be empty");
      if (key === "siteUrl" && out[key]) {
        let u;
        try {
          u = new URL(out[key]);
        } catch {
          throw Error("Invalid siteUrl: use a full http or https URL");
        }
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password ||
          u.search ||
          u.hash
        )
          throw Error(
            "Invalid siteUrl: use http or https without credentials, query or fragment",
          );
        out[key] = u.toString().replace(/\/$/, "");
      }
    }
  if (Object.hasOwn(input, "showHero")) {
    if (typeof input.showHero !== "boolean")
      throw Error("Invalid showHero: must be a boolean");
    out.showHero = input.showHero;
  }
  return out;
}
function read(dataDir) {
  const file = path.join(dataDir, FILE);
  if (!fs.existsSync(file)) return {};
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return validate(parsed);
}
function effective(base, dataDir) {
  const clean = { ...defaults };
  for (const key of Object.keys(defaults))
    if (Object.hasOwn(base, key)) {
      try {
        Object.assign(clean, validate({ [key]: base[key] }));
      } catch {}
    }
  if (!Object.hasOwn(base, "headerTitle")) clean.headerTitle = clean.siteTitle;
  return { ...clean, ...read(dataDir) };
}
function revision(dataDir) {
  try {
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(dataDir, FILE)))
      .digest("hex");
  } catch (e) {
    if (e.code === "ENOENT") return "missing";
    throw e;
  }
}
function write(dataDir, input, expected) {
  const next = validate(input);
  if (typeof expected !== "string" || revision(dataDir) !== expected) {
    const e = Error("Settings changed. Reload before saving.");
    e.status = 409;
    throw e;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, FILE),
    tmp = file + ".tmp-" + crypto.randomBytes(8).toString("hex");
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", {
      mode: 0o640,
    });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  return revision(dataDir);
}
module.exports = { FILE, limits, validate, read, effective, revision, write };
