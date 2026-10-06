'use strict';
// Frontmatter parsing for the build.
//
// Only YAML frontmatter is accepted. gray-matter would also run frontmatter
// that starts with ---js (or ---javascript) through eval(), which lets anyone
// who can save a markdown file run code on the machine that builds the site.
// Here the language after the opening --- must be empty, "yaml" or "yml";
// anything else is an error, and the executable and alternate engines are also
// replaced with ones that throw, so no other route reaches them.
//
// The YAML itself is read with js-yaml 4 (load() is safe by default).

const matter = require('gray-matter');
const yaml = require('js-yaml');

const OPEN = '---';
const ALLOWED_LANGUAGES = new Set(['', 'yaml', 'yml']);

function refuse(name) {
  return {
    parse() { throw new Error(`Unsupported frontmatter language "${name}". Only YAML frontmatter is allowed.`); },
    stringify() { throw new Error(`Unsupported frontmatter language "${name}". Only YAML frontmatter is allowed.`); },
  };
}

const engines = {
  yaml: {
    parse: (text) => yaml.load(text),
    stringify() { throw new Error('Writing frontmatter is not supported here.'); },
  },
  json: refuse('json'),
  javascript: refuse('javascript'),
  js: refuse('js'),
  coffee: refuse('coffee'),
  coffeescript: refuse('coffeescript'),
  cson: refuse('cson'),
};

function assertYamlOnly(text) {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!s.startsWith(OPEN)) return;
  const rest = s.slice(OPEN.length);
  // Same rule gray-matter uses: ---- is not an opening delimiter.
  if (rest.charAt(0) === '-') return;
  const newline = rest.search(/\r?\n/);
  const name = (newline === -1 ? rest : rest.slice(0, newline)).trim();
  if (!ALLOWED_LANGUAGES.has(name.toLowerCase())) {
    throw new Error(`Unsupported frontmatter language "${name}". Only YAML frontmatter is allowed.`);
  }
}

/**
 * Parse YAML frontmatter from markdown text.
 * @param {string|Buffer} input
 * @returns {{data: object, content: string}}
 */
function parseFrontmatter(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : input;
  if (typeof text !== 'string') {
    throw new TypeError('parseFrontmatter expects a string');
  }
  assertYamlOnly(text);
  // Passing options also skips gray-matter's shared result cache.
  return matter(text, { engines, language: 'yaml', excerpt: false });
}

module.exports = parseFrontmatter;
