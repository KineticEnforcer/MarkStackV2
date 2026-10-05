/**
 * MarkStack - Static Site Generator
 * 
 * A markdown-based knowledge base generator with GitHub-style features.
 * Transforms markdown content into a fully searchable documentation website.
 * 
 * @module build
 * @version 1.1.4
 * @author MarkStack Contributors
 * @license GPL-3.0
 * @see {@link https://github.com/markstack/markstack}
 */

'use strict';

// =============================================================================
// Dependencies
// =============================================================================

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const hljs = require('highlight.js');

// =============================================================================
// Site Configuration
// =============================================================================

// Load site configuration from siteconfig.json
const siteConfigPath = path.join(__dirname, 'siteconfig.json');
let siteConfig = {};
if (fs.existsSync(siteConfigPath)) {
  try {
    siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
  } catch (e) {
    console.warn('⚠ Warning: Could not parse siteconfig.json, using defaults');
  }
}

const SITE_ALLOWS_RAW_HTML = siteConfig.allowRawHtml === true;

// =============================================================================
// Markdown Configuration
// =============================================================================

// Initialize markdown-it with GitHub Flavored Markdown support
const md = require('markdown-it')({
  // Raw HTML in Markdown is off unless the site owner sets "allowRawHtml": true in
  // siteconfig.json (a file on the server; the editor cannot change it).
  html: SITE_ALLOWS_RAW_HTML,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    // Handle Mermaid diagrams - don't highlight, just wrap for client-side rendering
    if (lang === 'mermaid') {
      return '<pre class="mermaid">' + md.utils.escapeHtml(str) + '</pre>';
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs" data-language="' + lang + '"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>';
      } catch (err) {
        // Language not supported, fall through to plain text
      }
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

// Add anchor links to headings
const anchor = require('markdown-it-anchor');
md.use(anchor, {
  permalink: anchor.permalink.ariaHidden({
    placement: 'before',
    symbol: '#',
    class: 'heading-anchor'
  }),
  slugify: s => s.toLowerCase().replace(/[^\w]+/g, '-')
});

// Add footnote support
const footnote = require('markdown-it-footnote');
md.use(footnote);

// Add task list support
const taskLists = require('markdown-it-task-lists');
md.use(taskLists);

// -----------------------------------------------------------------------------
// GitHub-Style Alerts Plugin
// Transforms blockquotes starting with [!NOTE], [!TIP], etc. into styled alerts
// -----------------------------------------------------------------------------

/** SVG icons for each alert type */
const alertIcons = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>',
  important: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  caution: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>'
};

md.core.ruler.after('block', 'github-alerts', function(state) {
  const tokens = state.tokens;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'blockquote_open') {
      // Find the content inside the blockquote
      let j = i + 1;
      while (j < tokens.length && tokens[j].type !== 'blockquote_close') {
        if (tokens[j].type === 'inline') {
          const content = tokens[j].content;
          const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);

          if (alertMatch) {
            const alertType = alertMatch[1].toUpperCase();
            // Add class to blockquote
            tokens[i].attrJoin('class', 'alert');
            tokens[i].attrJoin('class', `alert-${alertType.toLowerCase()}`);
            // Remove the alert marker from content; the title is added after inline parsing
            tokens[j].content = content.replace(alertMatch[0], '');
            tokens[j].meta = Object.assign({}, tokens[j].meta, { alertType });
          }
        }
        j++;
      }
    }
  }
});

// The alert title is a real token, so it does not depend on raw HTML being enabled.
md.core.ruler.after('inline', 'github-alert-titles', function(state) {
  for (const tok of state.tokens) {
    if (tok.type !== 'inline' || !tok.meta || !tok.meta.alertType || !tok.children) continue;
    const title = new state.Token('alert_title', '', 0);
    title.meta = { alertType: tok.meta.alertType };
    const nl = new state.Token('text', '', 0);
    nl.content = '\n';
    tok.children.unshift(title, nl);
  }
});

md.renderer.rules.alert_title = function(tokens, idx) {
  const type = tokens[idx].meta.alertType;
  const icon = alertIcons[type.toLowerCase()] || '';
  return '<span class="alert-title"><span class="alert-icon">' + icon + '</span>' + type + '</span>';
};

// Configuration
const CONFIG = {
  contentDir: path.join(__dirname, 'content'),
  staticDir: path.join(__dirname, 'static'),
  templatesDir: path.join(__dirname, 'templates'),
  distDir: path.join(__dirname, 'dist'),
  siteTitle: siteConfig.siteTitle || 'Knowledge Base',
  headerTitle: siteConfig.headerTitle || siteConfig.siteTitle || 'Knowledge Base',
  siteSubtitle: siteConfig.siteSubtitle || '',
  siteUrl: siteConfig.siteUrl || '',  baseUrl: siteConfig.baseUrl || '',  defaultDescription: siteConfig.defaultDescription || 'Documentation and knowledge base',
  showHero: siteConfig.showHero !== false, // defaults to true
  copyrightText: siteConfig.copyrightText || ''
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Read and return the contents of a template file.
 * @param {string} name - Template name (without .html extension)
 * @returns {string} Template contents
 */
function readTemplate(name) {
  return fs.readFileSync(path.join(CONFIG.templatesDir, `${name}.html`), 'utf-8');
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath - Absolute path to the directory
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a directory and its contents recursively.
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Extract page title from frontmatter or derive from filename.
 * @param {string} filePath - Path to the markdown file
 * @param {Object} frontmatter - Parsed frontmatter object
 * @returns {string} Page title
 */
function getTitle(filePath, frontmatter) {
  if (frontmatter && frontmatter.title) {
    return frontmatter.title;
  }
  
  const basename = path.basename(filePath, '.md');
  if (basename === '_index') {
    // Use parent directory name
    const parentDir = path.basename(path.dirname(filePath));
    return formatTitle(parentDir);
  }
  return formatTitle(basename);
}

/**
 * Convert a slug or filename into a human-readable title.
 * @param {string} slug - URL slug or filename
 * @returns {string} Formatted title with proper capitalization
 */
function formatTitle(slug) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Convert a title into a URL-safe slug.
 * @param {string} title - Page or folder title
 * @returns {string} URL-safe slug
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

// =============================================================================
// URL Mapping
// =============================================================================

/** @type {Map<string, string>} Maps file paths to their title-based URLs */
const urlMap = new Map();

/**
 * Register a page or folder URL and fail the build if another source already
 * produces the same output URL. Without this a later page silently replaces an
 * earlier one in dist/.
 * @param {Map<string, string>} seen - Normalized URL to source path
 * @param {string} url - URL path being registered
 * @param {string} source - Content path that produces the URL
 */
function claimUrl(seen, url, source) {
  const key = url.replace(/\/+$/, '') || '/';
  if (seen.has(key)) {
    const a = path.relative(CONFIG.contentDir, seen.get(key));
    const b = path.relative(CONFIG.contentDir, source);
    throw new Error(`Duplicate URL ${key}/ is produced by both "${a}" and "${b}". Change one of the titles.`);
  }
  seen.set(key, source);
}

/**
 * Build URL map for all content by scanning the content directory.
 * Populates the global urlMap with file path to URL mappings.
 */
function buildUrlMap() {
  const seenUrls = new Map();
  function scanDirectory(dirPath, parentSlugPath = '') {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const entryPath = path.resolve(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Get folder title from _index.md or folder name
        const indexPath = path.resolve(entryPath, '_index.md');
        let folderTitle = formatTitle(entry.name);
        
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath, 'utf-8');
          const { data } = matter(content);
          if (data.title) folderTitle = data.title;
        }
        
        const folderSlug = slugify(folderTitle);
        const folderUrlPath = parentSlugPath + '/' + folderSlug;
        claimUrl(seenUrls, folderUrlPath, entryPath);
        
        // Map the _index.md file
        if (fs.existsSync(indexPath)) {
          urlMap.set(indexPath, folderUrlPath + '/');
        }
        
        // Also map the directory path for reference
        urlMap.set(entryPath, folderUrlPath + '/');
        
        // Recurse into subdirectory
        scanDirectory(entryPath, folderUrlPath);
      } else if (entry.name.endsWith('.md') && entry.name !== '_index.md') {
        const content = fs.readFileSync(entryPath, 'utf-8');
        const { data } = matter(content);
        const pageTitle = data.title || formatTitle(entry.name.replace('.md', ''));
        const pageSlug = slugify(pageTitle);
        const pageUrlPath = parentSlugPath + '/' + pageSlug;
        claimUrl(seenUrls, pageUrlPath, entryPath);
        
        urlMap.set(entryPath, pageUrlPath);
      }
    }
  }
  
  scanDirectory(CONFIG.contentDir);
}

/**
 * Get the URL path for a given file path using the URL map.
 * @param {string} filePath - Absolute path to the file
 * @returns {string} URL path for the file
 */
function getUrlPath(filePath) {
  // Normalize the path
  const normalizedPath = path.resolve(filePath);
  
  // Check for direct mapping
  if (urlMap.has(normalizedPath)) {
    return urlMap.get(normalizedPath);
  }
  
  // Check for directory (without _index.md)
  const dirPath = path.dirname(normalizedPath);
  if (urlMap.has(dirPath)) {
    return urlMap.get(dirPath);
  }
  
  // Fallback to old behavior
  const relativePath = path.relative(CONFIG.contentDir, filePath);
  let urlPath = relativePath
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')
    .replace(/_index$/, '');
  
  urlPath = '/' + urlPath;
  if (!urlPath.endsWith('/')) {
    urlPath += '/';
  }
  urlPath = urlPath.replace(/\/+/g, '/');
  
  return urlPath;
}

// =============================================================================
// Navigation Generation
// =============================================================================

/**
 * Build complete navigation tree from the content directory.
 * @param {string} [dirPath=CONFIG.contentDir] - Directory to scan
 * @param {string} [currentUrlPath=''] - Current page URL for highlighting
 * @returns {Array<Object>} Navigation tree structure
 */
function buildFullNavTree(dirPath = CONFIG.contentDir, currentUrlPath = '') {
  const items = [];
  
  if (!fs.existsSync(dirPath)) return items;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // Separate folders and files
  const folders = [];
  const files = [];
  
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    
    const entryPath = path.resolve(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      const indexPath = path.resolve(entryPath, '_index.md');
      let folderTitle = formatTitle(entry.name);
      
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        const { data } = matter(content);
        if (data.title) folderTitle = data.title;
      }
      
      const folderUrl = urlMap.get(entryPath) || '/' + path.relative(CONFIG.contentDir, entryPath).replace(/\\/g, '/') + '/';
      
      folders.push({
        type: 'folder',
        title: folderTitle,
        url: folderUrl,
        name: entry.name,
        expanded: currentUrlPath.startsWith(folderUrl),
        children: buildFullNavTree(entryPath, currentUrlPath)
      });
    } else if (entry.name.endsWith('.md') && entry.name !== '_index.md') {
      const fileContent = fs.readFileSync(entryPath, 'utf-8');
      const { data } = matter(fileContent);
      const fileUrl = urlMap.get(entryPath) || '/' + path.relative(CONFIG.contentDir, entryPath).replace(/\\/g, '/').replace('.md', '');
      
      files.push({
        type: 'file',
        title: getTitle(entryPath, data),
        url: fileUrl,
        name: entry.name,
        current: fileUrl === currentUrlPath
      });
    }
  }
  
  // Sort alphabetically by title
  folders.sort((a, b) => a.title.localeCompare(b.title));
  files.sort((a, b) => a.title.localeCompare(b.title));
  
  return [...folders, ...files];
}

/**
 * Build navigation context for a specific page.
 * @param {string} filePath - Path to the current file
 * @param {string} urlPath - URL of the current page
 * @returns {Object} Navigation object with breadcrumbs and sidebar
 */
function buildNavigationTree(filePath, urlPath) {
  const nav = {
    breadcrumbs: [],
    sidebar: buildFullNavTree(CONFIG.contentDir, urlPath)
  };
  
  // Build breadcrumbs from file path structure
  const relativePath = path.relative(CONFIG.contentDir, filePath).replace(/\\/g, '/');
  const pathParts = relativePath.split('/').filter(Boolean);
  
  nav.breadcrumbs.push({ title: 'Home', url: '/' });
  
  // Build breadcrumbs by walking up the directory tree
  let currentBreadcrumbPath = CONFIG.contentDir;
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    currentBreadcrumbPath = path.resolve(currentBreadcrumbPath, part);
    
    // Skip _index.md - the directory breadcrumb already represents it
    if (part === '_index.md') {
      continue;
    }
    
    // Skip the .md extension for the last part if it's a file
    if (part.endsWith('.md')) {
      // Get the page's URL from urlMap
      const pageUrl = urlMap.get(path.resolve(currentBreadcrumbPath.replace('.md', '') + '.md'));
      if (pageUrl) {
        const pageContent = fs.readFileSync(currentBreadcrumbPath, 'utf-8');
        const { data } = matter(pageContent);
        nav.breadcrumbs.push({
          title: data.title || formatTitle(part.replace('.md', '')),
          url: pageUrl
        });
      }
    } else {
      // It's a directory - get its URL from urlMap
      const dirUrl = urlMap.get(currentBreadcrumbPath);
      const indexPath = path.resolve(currentBreadcrumbPath, '_index.md');
      let dirTitle = formatTitle(part);
      
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        const { data } = matter(content);
        if (data.title) dirTitle = data.title;
      }
      
      if (dirUrl) {
        nav.breadcrumbs.push({
          title: dirTitle,
          url: dirUrl
        });
      }
    }
  }
  
  return nav;
}

// =============================================================================
// HTML Rendering
// =============================================================================

/** Home icon SVG for breadcrumb navigation */
const homeIcon = '<svg class="breadcrumb-home-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Zm1.25 1.171a.25.25 0 0 0-.312 0l-5.25 4.2a.25.25 0 0 0-.094.196v7.019c0 .138.112.25.25.25H5.5V9.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v4.5h2.25a.25.25 0 0 0 .25-.25V6.23a.25.25 0 0 0-.094-.195Z"/></svg>';

/**
 * Render breadcrumb navigation HTML.
 * @param {Array<Object>} breadcrumbs - Array of breadcrumb items
 * @returns {string} HTML string for breadcrumbs
 */
function renderBreadcrumbs(breadcrumbs) {
  const items = breadcrumbs.map((item, i) => {
    const url = CONFIG.baseUrl + item.url;
    if (i === 0) {
      // Home link with icon
      return `<a href="${url}" class="breadcrumb-home" title="Home">${homeIcon}</a>`;
    }
    if (i === breadcrumbs.length - 1) {
      return `<span class="breadcrumb-current">${item.title}</span>`;
    }
    return `<a href="${url}">${item.title}</a>`;
  });
  
  return items.join('<span class="breadcrumb-separator">/</span>');
}

/** Sidebar icons for folder and file items */
const sidebarIcons = {
  folder: '<svg class="sidebar-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>',
  file: '<svg class="sidebar-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>'
};

/** Chevron icons for expandable tree navigation */
const chevronRight = '<svg class="sidebar-chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>';
const chevronDown = '<svg class="sidebar-chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"/></svg>';

/**
 * Render sidebar navigation HTML recursively.
 * @param {Array<Object>} sidebar - Sidebar tree structure
 * @param {number} [level=0] - Current nesting level
 * @returns {string} HTML string for sidebar
 */
function renderSidebar(sidebar, level = 0) {
  if (!sidebar || sidebar.length === 0) return '';
  
  let html = `<ul class="sidebar-list sidebar-level-${level}">\n`;
  
  for (const item of sidebar) {
    const classes = ['sidebar-item', `sidebar-${item.type}`];
    if (item.current) classes.push('sidebar-current');
    if (item.expanded) classes.push('sidebar-expanded');
    
    const hasChildren = item.children && item.children.length > 0;
    
    if (item.type === 'folder') {
      const chevron = hasChildren ? (item.expanded ? chevronDown : chevronRight) : '';
      const expandedClass = item.expanded ? 'expanded' : 'collapsed';
      const url = CONFIG.baseUrl + item.url;
      
      html += `<li class="${classes.join(' ')}" data-state="${expandedClass}">`;
      html += `<div class="sidebar-folder-header">`;
      if (hasChildren) {
        html += `<button class="sidebar-toggle" aria-label="Toggle folder">${chevron}</button>`;
      }
      html += `<a href="${url}">${sidebarIcons.folder}${item.title}</a>`;
      html += `</div>`;
      
      if (hasChildren) {
        html += `<div class="sidebar-children ${expandedClass}">`;
        html += renderSidebar(item.children, level + 1);
        html += '</div>';
      }
      html += '</li>\n';
    } else {
      // File
      const url = CONFIG.baseUrl + item.url;
      html += `<li class="${classes.join(' ')}">`;
      html += `<a href="${url}">${sidebarIcons.file}${item.title}</a>`;
      html += '</li>\n';
    }
  }
  
  html += '</ul>';
  return html;
}

// =============================================================================
// Page Generation
// =============================================================================

/**
 * Process a single markdown file into page data.
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} Processed page data including content, navigation, and metadata
 */
function processMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: markdownContent } = matter(content);
  
  const title = getTitle(filePath, frontmatter);
  const urlPath = getUrlPath(filePath);
  const nav = buildNavigationTree(filePath, urlPath);
  
  // Render markdown content only (no inline cards - navigation is in sidebar tree)
  const htmlContent = md.render(markdownContent);
  
  return {
    title,
    description: frontmatter.description || CONFIG.defaultDescription,
    content: htmlContent,
    urlPath,
    breadcrumbs: nav.breadcrumbs,
    sidebar: nav.sidebar,
    frontmatter
  };
}

/**
 * Generate HTML page from processed content.
 * @param {Object} processed - Processed page data from processMarkdownFile
 * @returns {string} Complete HTML page
 */
function generatePage(processed) {
  const template = readTemplate('base');
  const pageClass = processed.isHomepage ? ' is-homepage' : '';
  
  let html = template
    .replace(/\{\{siteTitle\}\}/g, CONFIG.headerTitle)
    .replace(/\{\{title\}\}/g, processed.title)
    .replace(/\{\{description\}\}/g, processed.description)
    .replace(/\{\{url\}\}/g, CONFIG.siteUrl + processed.urlPath)
    .replace(/\{\{baseUrl\}\}/g, CONFIG.baseUrl)
    .replace(/\{\{breadcrumbs\}\}/g, renderBreadcrumbs(processed.breadcrumbs))
    .replace(/\{\{sidebar\}\}/g, renderSidebar(processed.sidebar))
    .replace(/\{\{pageClass\}\}/g, pageClass)
    .replace(/\{\{copyrightText\}\}/g, CONFIG.copyrightText)
    .replace(/\{\{content\}\}/g, processed.content);
  
  return html;
}

/** @type {Array<Object>} Search index entries for client-side search */
const searchIndex = [];

/**
 * Turn rendered HTML into plain text for the search index.
 * @param {string} html - Rendered HTML (or markdown) fragment
 * @returns {string} Plain text
 */
function toSearchText(html) {
  return html
    .replace(/<a class="heading-anchor"[^>]*>[^<]*<\/a>/g, '')  // Heading permalink marker
    .replace(/<(pre|script|style|svg|table-copy)\b[\s\S]*?<\/\1>/g, ' ')  // Code blocks and diagrams are not prose
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Add a page and its headings (h2 to h4) to the search index.
 * Each entry has a type, title, url, path (the folders above it) and text.
 * @param {Object} processed - Result of processMarkdownFile
 */
function addToSearchIndex(processed) {
  const trail = (processed.breadcrumbs || []).slice(1, -1).map(b => toSearchText(b.title));
  const html = processed.content;
  const headingRe = /<h([2-4])\s[^>]*?id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  const marks = [];
  let m;
  while ((m = headingRe.exec(html))) {
    marks.push({ id: m[2], title: toSearchText(m[3]), start: m.index, end: headingRe.lastIndex });
  }
  const introEnd = marks.length ? marks[0].start : html.length;
  searchIndex.push({
    type: 'page',
    title: processed.title,
    url: processed.urlPath,
    path: trail,
    description: processed.description,
    text: toSearchText(html.slice(0, introEnd))
  });
  marks.forEach((mark, i) => {
    const stop = i + 1 < marks.length ? marks[i + 1].start : html.length;
    searchIndex.push({
      type: 'section',
      title: mark.title,
      url: processed.urlPath + '#' + mark.id,
      path: trail.concat(processed.title),
      text: toSearchText(html.slice(mark.end, stop))
    });
  });
}

/**
 * Process all markdown files in a directory recursively.
 * @param {string} dirPath - Directory path to process
 */
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.md')) {
      const processed = processMarkdownFile(fullPath);
      const html = generatePage(processed);
      
      // Determine output path
      const outputPath = path.join(CONFIG.distDir, processed.urlPath, 'index.html');
      
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, html);
      
      // Add to search index: one entry for the page and one per heading
      addToSearchIndex(processed);
      
      console.log(`✓ Generated: ${processed.urlPath}`);
    }
  }
}

// =============================================================================
// Special Pages
// =============================================================================

/**
 * Generate the homepage with optional hero section and custom content.
 */
function generateHomepage() {
  let content = '';
  
  // Show hero section
  if (CONFIG.showHero && (CONFIG.siteTitle || CONFIG.siteSubtitle)) {
    content += '<div class="homepage-hero">';
    if (CONFIG.siteTitle) {
      content += `<h1>${CONFIG.siteTitle}</h1>`;
    }
    if (CONFIG.siteSubtitle) {
      content += `<p>${CONFIG.siteSubtitle}</p>`;
    }
    content += '</div>';
  }
  
  // Check for content/_index.md for custom homepage content
  const homepageIndexPath = path.join(CONFIG.contentDir, '_index.md');
  let homepageDescription = CONFIG.defaultDescription;
  
  if (fs.existsSync(homepageIndexPath)) {
    const homepageContent = fs.readFileSync(homepageIndexPath, 'utf-8');
    const { data: frontmatter, content: markdownContent } = matter(homepageContent);
    
    // Use description from frontmatter if available
    if (frontmatter.description) {
      homepageDescription = frontmatter.description;
    }
    
    // Render markdown content below hero
    if (markdownContent.trim()) {
      content += '<div class="homepage-content">';
      content += md.render(markdownContent);
      content += '</div>';
    }
  }
  
  const processed = {
    title: 'Home',
    description: homepageDescription,
    content,
    urlPath: '/',
    breadcrumbs: [{ title: 'Home', url: '/' }],
    sidebar: buildFullNavTree(CONFIG.contentDir, '/'),
    isHomepage: true
  };
  
  const html = generatePage(processed);
  const outputPath = path.join(CONFIG.distDir, 'index.html');
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, html);
  console.log('✓ Generated: / (homepage)');
}

/**
 * Generate the 404 error page.
 */
function generate404() {
  const content = `<div class="error-page">
    <h1>404</h1>
    <p>Page not found</p>
    <a href="/" class="btn">Return Home</a>
  </div>`;
  
  const processed = {
    title: 'Page Not Found',
    description: 'The requested page could not be found.',
    content,
    urlPath: '/404/',
    breadcrumbs: [{ title: 'Home', url: '/' }, { title: '404', url: '/404/' }],
    sidebar: []
  };
  
  const html = generatePage(processed);
  fs.writeFileSync(path.join(CONFIG.distDir, '404.html'), html);
  console.log('✓ Generated: /404.html');
}

/**
 * Generate the search index JSON file for client-side search.
 */
function generateSearchIndex() {
  const outputPath = path.join(CONFIG.distDir, 'search-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(searchIndex, null, 2));
  console.log(`✓ Generated: /search-index.json (${searchIndex.length} pages)`);
}

// =============================================================================
// Build Process
// =============================================================================

/**
 * Main build function - orchestrates the complete site generation.
 */
function build() {
  console.log('\n🔨 Building MarkStack...\n');
  
  const startTime = Date.now();
  
  // Clear URL map and search index for fresh build
  urlMap.clear();
  searchIndex.length = 0;
  
  // Build URL map for title-based URLs. Done before touching dist/ so a
  // duplicate URL fails the build and leaves the last good output in place.
  try {
    buildUrlMap();
  } catch (err) {
    console.error(`\n❌ Build failed: ${err.message}\n`);
    process.exitCode = 1;
    return false;
  }
  
  // Clean dist directory
  if (fs.existsSync(CONFIG.distDir)) {
    fs.rmSync(CONFIG.distDir, { recursive: true });
  }
  ensureDir(CONFIG.distDir);
  
  // Copy static files
  if (fs.existsSync(CONFIG.staticDir)) {
    copyDir(CONFIG.staticDir, CONFIG.distDir);
    console.log('✓ Copied static files\n');
  }
  
  // Process content
  if (fs.existsSync(CONFIG.contentDir)) {
    processDirectory(CONFIG.contentDir);
  }
  
  // Generate special pages
  generateHomepage();
  generate404();
  
  // Generate search index
  generateSearchIndex();
  
  const elapsed = Date.now() - startTime;
  console.log(`\n✅ Build complete in ${elapsed}ms`);
  console.log(`📁 Output: ${CONFIG.distDir}\n`);
}

// =============================================================================
// CLI Entry Point
// =============================================================================

if (process.argv.includes('--watch')) {
  const chokidar = require('chokidar');
  
  console.log('👀 Watching for changes...\n');
  
  build();
  
  const watcher = chokidar.watch([CONFIG.contentDir, CONFIG.staticDir, CONFIG.templatesDir], {
    ignored: /^\./,
    persistent: true
  });
  
  watcher.on('change', (filePath) => {
    console.log(`\n📝 Changed: ${filePath}`);
    build();
  });
  
  watcher.on('add', (filePath) => {
    console.log(`\n➕ Added: ${filePath}`);
    build();
  });
  
  watcher.on('unlink', (filePath) => {
    console.log(`\n➖ Removed: ${filePath}`);
    build();
  });
} else {
  build();
}
