'use strict';
/**
 * Section access rules for the editor. Pure functions plus filesystem checks,
 * no HTTP and no sessions, so they can be tested alone and reused by every
 * API route.
 *
 * Provisional model (not final until the section meaning is decided):
 * a section is one top-level folder of content/ and everything below it.
 * An administrator may touch anything inside content/. An editor may touch
 * only inside the sections assigned to them. Everything else answers as if
 * it does not exist, so another section's file names are not disclosed.
 */
const fs = require('fs');
const path = require('path');

const ACTIONS = new Set(['list', 'read', 'write', 'create', 'rename', 'delete']);

/** Valid section name: one folder name, no separators, not hidden. */
function isValidSectionName(name) {
  return typeof name === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(name);
}

/**
 * Turn a user supplied relative path into clean segments, or null when it is
 * unusable (not a string, empty, absolute, NUL byte, or climbs out with "..").
 */
function cleanSegments(rel) {
  if (typeof rel !== 'string' || rel.length === 0 || rel.includes('\0')) return null;
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  const parts = rel.split(/[\\/]+/).filter(p => p !== '' && p !== '.');
  if (parts.length === 0) return null;
  if (parts.some(p => p === '..')) return null;
  return parts;
}

/** Real path of the deepest existing ancestor of target, joined with the rest. */
function realOfDeepest(target) {
  let probe = path.resolve(target);
  const rest = [];
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return null;
    rest.unshift(path.basename(probe));
    probe = parent;
  }
  try {
    return path.join(fs.realpathSync(probe), ...rest);
  } catch (e) {
    return null;
  }
}

function within(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function deny(status, reason) {
  return { allow: false, status, reason };
}

/** True when target resolves (symlinks followed) inside base. */
function realInside(base, target) {
  let realBase;
  try { realBase = fs.realpathSync(base); } catch (e) { return false; }
  const real = realOfDeepest(target);
  return real !== null && within(realBase, real);
}

/**
 * Decide whether user may perform action on relPath (relative to contentDir).
 * For rename, newRelPath is the destination.
 * Returns { allow: true } or { allow: false, status, reason }.
 * Outside an editor's sections the status is always 404, never 403.
 */
function authorize(user, action, relPath, opts) {
  const { contentDir, newRelPath } = opts;
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) return deny(401, 'no user');
  if (!ACTIONS.has(action)) return deny(400, 'unknown action');

  const parts = cleanSegments(relPath);
  if (!parts) return deny(400, 'invalid path');
  const full = path.join(contentDir, ...parts);
  if (!realInside(contentDir, full)) return deny(403, 'outside content');

  let destParts = null;
  if (action === 'rename') {
    destParts = cleanSegments(newRelPath);
    if (!destParts) return deny(400, 'invalid destination');
    if (!realInside(contentDir, path.join(contentDir, ...destParts))) return deny(403, 'outside content');
  }

  if (user.role === 'admin') {
    return { allow: true };
  }

  const sections = Array.isArray(user.sections) ? user.sections.filter(isValidSectionName) : [];
  const section = parts[0];
  if (!sections.includes(section)) return deny(404, 'not in assigned sections');

  // The section must be a real folder directly under content/, and the target
  // must stay inside it after symlinks are followed.
  const sectionDir = path.join(contentDir, section);
  let realSection;
  try {
    const st = fs.lstatSync(sectionDir);
    if (!st.isDirectory()) return deny(404, 'not in assigned sections');
    realSection = fs.realpathSync(sectionDir);
    if (path.dirname(realSection) !== fs.realpathSync(contentDir)) return deny(404, 'not in assigned sections');
  } catch (e) {
    return deny(404, 'not in assigned sections');
  }
  const realTarget = realOfDeepest(full);
  if (realTarget === null || !within(realSection, realTarget)) return deny(404, 'not in assigned sections');

  const isSectionRoot = parts.length === 1;
  if (isSectionRoot && (action === 'rename' || action === 'delete' || action === 'write')) {
    return deny(403, 'section folder itself is admin only');
  }
  if (action === 'rename') {
    if (destParts[0] !== section) return deny(403, 'cannot move to another section');
    const realDest = realOfDeepest(path.join(contentDir, ...destParts));
    if (realDest === null || !within(realSection, realDest)) return deny(403, 'cannot move to another section');
  }
  return { allow: true };
}

/**
 * Filter a file tree (as returned by scanDirectory) for a user. Admins see all.
 * Editors see only their assigned top-level sections.
 */
function filterTree(user, tree) {
  if (user && user.role === 'admin') return tree;
  const sections = user && Array.isArray(user.sections) ? user.sections.filter(isValidSectionName) : [];
  return tree.filter(n => n.type === 'folder' && sections.includes(n.name));
}

module.exports = { authorize, filterTree, cleanSegments, isValidSectionName };
