"use strict";
const fs = require("fs");
const path = require("path");
const parse = require("./frontmatter");
const yaml = require("js-yaml");
const crypto = require("crypto");
const format = (s) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const revision = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");
function catalog(root, users) {
  const sections = [],
    pages = [];
  function scan(dir, rel, parentUrl, section) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name),
        relative = rel ? rel + "/" + entry.name : entry.name;
      if (entry.isDirectory()) {
        const index = path.join(full, "_index.md");
        const text =
          fs.existsSync(index) && fs.lstatSync(index).isFile()
            ? fs.readFileSync(index, "utf8")
            : "";
        const data = parse(text).data || {};
        const title =
          typeof data.title === "string" && data.title
            ? data.title
            : format(entry.name);
        const url = parentUrl + "/" + slug(title);
        if (!rel)
          sections.push({
            name: entry.name,
            title,
            path: relative,
            url: url + "/",
            order: Number.isInteger(data.order) ? data.order : 0,
            hidden: data.hidden === true,
            revision: revision(text),
            editors: users
              .filter(
                (u) => u.role === "editor" && u.sections.includes(entry.name),
              )
              .map((u) => u.name),
            pageCount: 0,
          });
        scan(full, relative, url, section || entry.name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const text = fs.readFileSync(full, "utf8"),
          data = parse(text).data || {};
        const title =
          typeof data.title === "string" && data.title
            ? data.title
            : format(
                entry.name === "_index.md"
                  ? path.basename(dir)
                  : entry.name.slice(0, -3),
              );
        pages.push({
          title,
          path: relative,
          section: section || null,
          url:
            entry.name === "_index.md"
              ? (parentUrl || "") + "/"
              : parentUrl + "/" + slug(title),
          modifiedAt: fs.statSync(full).mtime.toISOString(),
        });
      }
    }
  }
  if (fs.existsSync(root)) scan(root, "", "", null);
  sections.forEach(
    (s) => (s.pageCount = pages.filter((p) => p.section === s.name).length),
  );
  sections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  pages.sort((a, b) => a.path.localeCompare(b.path));
  return { sections, pages };
}
/** Replace only owned metadata keys, retaining body and all other frontmatter text. */
function updateSection(text, settings) {
  const parsed = parse(text);
  if (
    typeof settings.title !== "string" ||
    !settings.title.trim() ||
    settings.title.length > 120
  )
    throw Error("Title must be 1 to 120 characters");
  if (
    !Number.isInteger(settings.order) ||
    settings.order < -10000 ||
    settings.order > 10000
  )
    throw Error("Position must be an integer between -10000 and 10000");
  if (typeof settings.hidden !== "boolean")
    throw Error("Visibility must be a boolean");
  const source = text.replace(/^\uFEFF/, ""),
    match = source.match(
      /^---(?:yaml|yml)?[ \t]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/i,
    );
  const owned = new Set(["title", "order", "hidden"]);
  let lines = match ? match[1].split(/\r?\n/) : [],
    kept = [],
    skipping = false;
  for (const line of lines) {
    const key = line.match(/^([a-zA-Z_][\w-]*):/);
    if (key) skipping = owned.has(key[1]);
    if (!skipping) kept.push(line);
  }
  const metadata = yaml
    .dump(
      {
        title: settings.title.trim(),
        order: settings.order,
        hidden: settings.hidden,
      },
      { lineWidth: -1 },
    )
    .trimEnd();
  const body = match ? source.slice(match[0].length) : text;
  const result =
    "---\n" +
    (kept.length ? kept.join("\n") + "\n" : "") +
    metadata +
    "\n---\n" +
    body;
  const after = parse(result).data || {};
  const before = parsed.data || {};
  const { isDeepStrictEqual } = require("node:util");
  const keys = Array.from(
    new Set(Object.keys(before).concat(Object.keys(after))),
  ).filter((k) => !owned.has(k));
  if (keys.some((k) => !isDeepStrictEqual(before[k], after[k])))
    throw Error(
      "Complex frontmatter cannot be updated safely here. Edit _index.md in the editor instead.",
    );
  if (
    after.title !== settings.title.trim() ||
    after.order !== settings.order ||
    after.hidden !== settings.hidden
  )
    throw Error(
      "Section metadata could not be updated safely. Edit _index.md instead.",
    );
  return result;
}
module.exports = { catalog, updateSection, revision };
