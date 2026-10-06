/**
 * MarkStack - Client-side JavaScript
 * 
 * Handles interactive features for the documentation site:
 * - Theme toggle (dark/light mode with persistence)
 * - Sidebar navigation (collapsible tree with state persistence)
 * - Full-text search (fuzzy matching with keyboard navigation)
 * - Code block copy buttons
 * - Smooth scroll for anchor links
 * 
 * @version 1.1.4
 * @license GPL-3.0
 */

(function() {
  'use strict';

  // Browser storage can be blocked or full (private mode, policies). Every read
  // and write below goes through these wrappers so the page keeps working.
  function safeStore(kind) {
    return {
      getItem: function(k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      setItem: function(k, v) { try { window[kind].setItem(k, v); } catch (e) {} },
      removeItem: function(k) { try { window[kind].removeItem(k); } catch (e) {} }
    };
  }
  const localStorage = safeStore('localStorage');
  const sessionStorage = safeStore('sessionStorage');

  // ============================================
  // Theme Toggle
  // ============================================
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  
  // Get saved theme or default to dark
  function getSavedTheme() {
    return localStorage.getItem('theme') || 'dark';
  }
  
  // Apply theme
  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
  
  // Initialize theme (already set by inline script, but ensure it's correct)
  setTheme(getSavedTheme());
  
  // Toggle theme on button click
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  // ============================================
  // Sidebar Toggle
  // ============================================
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mainLayout = document.querySelector('.main-layout');
  const body = document.body;
  const sidebarNav = document.querySelector('.sidebar-nav');
  
  // Get saved sidebar state
  function getSavedSidebarState() {
    return localStorage.getItem('sidebar-state');
  }
  
  // Save sidebar state
  function saveSidebarState(collapsed) {
    localStorage.setItem('sidebar-state', collapsed ? 'collapsed' : 'expanded');
  }
  
  // Apply sidebar state (sync html, body, and mainLayout)
  function setSidebarCollapsed(collapsed) {
    if (collapsed) {
      html.classList.add('sidebar-collapsed');
      body.classList.add('sidebar-collapsed');
      if (mainLayout) mainLayout.classList.add('sidebar-collapsed');
    } else {
      html.classList.remove('sidebar-collapsed');
      body.classList.remove('sidebar-collapsed');
      if (mainLayout) mainLayout.classList.remove('sidebar-collapsed');
    }
  }
  
  // Initialize sidebar state
  if (mainLayout && sidebarToggle) {
    const savedState = getSavedSidebarState();
    // Default is expanded, only collapse if user explicitly collapsed
    setSidebarCollapsed(savedState === 'collapsed');
    
    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', function() {
      const isCurrentlyCollapsed = body.classList.contains('sidebar-collapsed');
      setSidebarCollapsed(!isCurrentlyCollapsed);
      saveSidebarState(!isCurrentlyCollapsed);
    });
  }

  // ============================================
  // Mobile Menu Toggle
  // ============================================
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileOverlay = document.getElementById('mobile-overlay');
  
  function closeMobileMenu() {
    body.classList.remove('mobile-menu-open');
    document.documentElement.classList.remove('mobile-menu-open');
    sessionStorage.removeItem('mobile-menu-open');
  }
  
  function openMobileMenu() {
    body.classList.add('mobile-menu-open');
    document.documentElement.classList.add('mobile-menu-open');
  }
  
  function toggleMobileMenu() {
    if (body.classList.contains('mobile-menu-open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }
  
  // Restore mobile menu state on page load (for folder navigation)
  if (sessionStorage.getItem('mobile-menu-open') === 'true') {
    openMobileMenu();
    sessionStorage.removeItem('mobile-menu-open');
  }
  
  // Robust touch + click handling for iOS Chrome/Safari
  if (mobileMenuToggle) {
    let touchHandled = false;
    
    // touchend fires quickly on iOS; use passive to avoid blocking
    mobileMenuToggle.addEventListener('touchend', function() {
      touchHandled = true;
      toggleMobileMenu();
      setTimeout(function() { touchHandled = false; }, 200);
    }, { passive: true });
    
    // click as fallback (desktop / non-touch)
    mobileMenuToggle.addEventListener('click', function() {
      if (!touchHandled) {
        toggleMobileMenu();
      }
    });
  }
  
  if (mobileOverlay) {
    mobileOverlay.addEventListener('touchend', closeMobileMenu, { passive: true });
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }
  
  // Close mobile menu only when clicking a file link (not folder links)
  if (sidebarNav) {
    sidebarNav.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;
      
      // Check if this is a file link (not inside a folder header)
      const isFileLink = e.target.closest('.sidebar-file');
      const isFolderToggle = e.target.closest('.sidebar-toggle');
      const isFolderLink = e.target.closest('.sidebar-folder');
      
      // Only close menu when clicking on actual file links
      if (isFileLink && !isFolderToggle) {
        closeMobileMenu();
      }
      
      // If clicking a folder link (not the toggle), save menu state before navigation
      if (isFolderLink && !isFolderToggle && body.classList.contains('mobile-menu-open')) {
        sessionStorage.setItem('mobile-menu-open', 'true');
      }
    });
  }
  
  // Close mobile menu on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && body.classList.contains('mobile-menu-open')) {
      closeMobileMenu();
    }
  });

  // ============================================
  // Sidebar Tree Toggle
  // ============================================
  
  // Chevron SVG icons
  const chevronRight = '<svg class="sidebar-chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>';
  const chevronDown = '<svg class="sidebar-chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"/></svg>';
  
  if (sidebarNav) {
    const sidebarEl = document.querySelector('.sidebar');
    // Keys are scoped to this site's base path so sites sharing an origin do not share state
    const navScope = baseUrlForNav();
    const openKey = 'sidebar-open:' + navScope;
    const scrollKey = 'sidebar-scroll:' + navScope;
    function baseUrlForNav() {
      const l = document.querySelector('.site-logo');
      return (l ? l.getAttribute('href') : '/').replace(/\/$/, '');
    }

    function readOpen() {
      try {
        const v = JSON.parse(localStorage.getItem(openKey) || '[]');
        return Array.isArray(v) ? v.filter(function(x) { return typeof x === 'string'; }) : [];
      } catch (e) { return []; }
    }
    function writeOpen(list) {
      try { localStorage.setItem(openKey, JSON.stringify(list)); } catch (e) {}
    }
    function setOpen(item, open) {
      const children = item.querySelector(':scope > .sidebar-children');
      const toggle = item.querySelector(':scope > .sidebar-folder-header .sidebar-toggle');
      if (!children) return;
      children.classList.toggle('expanded', open);
      item.classList.toggle('sidebar-expanded', open);
      item.dataset.state = open ? 'expanded' : 'collapsed';
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    // Folders on the way to the current page count as opened by the reader
    let firstVisit = false;
    try { firstVisit = localStorage.getItem(openKey) === null; } catch (e) {}
    const opened = new Set(readOpen());
    if (firstVisit) {
      sidebarNav.querySelectorAll('.sidebar-level-0 > .sidebar-folder').forEach(function(li) {
        opened.add(li.getAttribute('data-path'));
      });
    }
    sidebarNav.querySelectorAll('.sidebar-item.sidebar-folder.sidebar-expanded').forEach(function(li) {
      opened.add(li.getAttribute('data-path'));
    });
    writeOpen(Array.from(opened));

    // Expand or collapse a folder in place (animated, remembered across pages)
    sidebarNav.addEventListener('click', function(e) {
      const toggle = e.target.closest('.sidebar-toggle');
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      const item = toggle.closest('.sidebar-item');
      const open = item.dataset.state !== 'expanded';
      setOpen(item, open);
      const list = new Set(readOpen());
      if (open) list.add(item.getAttribute('data-path')); else list.delete(item.getAttribute('data-path'));
      writeOpen(Array.from(list));
    });

    // One marker rides the rail beside the list and glides to the current page,
    // starting from where it was on the previous page.
    const indicator = document.createElement('span');
    indicator.className = 'sidebar-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    sidebarNav.appendChild(indicator);
    const indKey = 'sidebar-ind:' + navScope;
    function currentRow() {
      return sidebarNav.querySelector('.sidebar-current > a, .sidebar-current > .sidebar-folder-header a');
    }
    function targetBox() {
      const row = currentRow();
      if (!row) return null;
      // hidden inside a closed folder: no marker rather than a wrong one
      if (row.closest('.sidebar-children:not(.expanded)')) return null;
      const n = sidebarNav.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      return { top: r.top - n.top + 3, height: Math.max(r.height - 6, 8) };
    }
    function placeIndicator() {
      const box = targetBox();
      if (!box) { indicator.style.opacity = '0'; return; }
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(' + box.top + 'px)';
      indicator.style.height = box.height + 'px';
    }
    function followFor(ms) {
      const end = performance.now() + ms;
      (function step() { placeIndicator(); if (performance.now() < end) requestAnimationFrame(step); })();
    }
    (function startIndicator() {
      const box = targetBox();
      if (!box) { placeIndicator(); return; }
      let from = null;
      try { from = JSON.parse(sessionStorage.getItem(indKey) || 'null'); } catch (e) {}
      indicator.style.transition = 'none';
      if (from && typeof from.top === 'number' && typeof from.height === 'number') {
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(' + from.top + 'px)';
        indicator.style.height = from.height + 'px';
      } else {
        // First page with a marker (for example the first click from the home page):
        // slide in from just above the row instead of appearing in place
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(' + (box.top - 14) + 'px)';
        indicator.style.height = box.height + 'px';
      }
      void indicator.offsetHeight;
      indicator.style.transition = '';
      placeIndicator();
      try { sessionStorage.setItem(indKey, JSON.stringify(box)); } catch (e) {}
    })();
    window.addEventListener('resize', placeIndicator);
    sidebarNav.addEventListener('click', function(e) {
      if (e.target.closest('.sidebar-toggle')) followFor(260);
    });

    // Remember where the list was scrolled, so the next page opens in the same place
    function saveScroll() {
      try { sessionStorage.setItem(scrollKey, String(sidebarEl.scrollTop)); } catch (e) {}
    }
    sidebarEl.addEventListener('scroll', saveScroll, { passive: true });
    sidebarNav.addEventListener('click', saveScroll);
    window.addEventListener('pagehide', saveScroll);

    // Bring the current page into view only if it is really outside the visible list;
    // a position restored before first paint is left alone
    const current = sidebarNav.querySelector('.sidebar-current > a, .sidebar-current > .sidebar-folder-header a');
    if (current && sidebarEl.scrollHeight > sidebarEl.clientHeight) {
      const box = sidebarEl.getBoundingClientRect();
      const r = current.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) {
        sidebarEl.scrollTop += r.top - box.top - box.height / 3;
      }
    }
  }

  // ============================================
  // Search (one window, Pages and Sections)
  // ============================================
  const searchInput = document.getElementById('search-input');
  const baseUrl = document.querySelector('.site-logo')
    ? document.querySelector('.site-logo').getAttribute('href').replace(/\/$/, '')
    : '';
  let prepared = null;
  let loading = null;
  let palette = null;
  let rows = [];
  let selected = -1;
  let lastFocus = null;

  function loadIndex() {
    if (prepared) return Promise.resolve(prepared);
    if (!loading) {
      loading = fetch(baseUrl + '/search-index.json')
        .then(function(r) { return r.json(); })
        .then(function(data) { prepared = SearchCore.prepare(data); return prepared; })
        .catch(function(err) { loading = null; console.error('Failed to load search index:', err); return []; });
    }
    return loading;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /** Put text in a node, wrapping matched words in <mark> (no innerHTML). */
  function fillHighlighted(node, text, query) {
    const ranges = SearchCore.highlightRanges(text, query);
    let pos = 0;
    ranges.forEach(function(r) {
      if (r[0] > pos) node.appendChild(document.createTextNode(text.slice(pos, r[0])));
      node.appendChild(el('mark', null, text.slice(r[0], r[1])));
      pos = r[1];
    });
    if (pos < text.length) node.appendChild(document.createTextNode(text.slice(pos)));
  }

  function buildPalette() {
    const overlay = el('div', 'search-palette');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Search documentation');
    const box = el('div', 'search-palette-box');
    const input = el('input', 'search-palette-input');
    input.type = 'text';
    input.placeholder = 'Search documentation...';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', 'search-palette-list');
    input.setAttribute('aria-expanded', 'true');
    const list = el('div', 'search-palette-list');
    list.id = 'search-palette-list';
    list.setAttribute('role', 'listbox');
    const foot = el('div', 'search-palette-foot');
    foot.appendChild(el('span', null, '\u2191\u2193 move'));
    foot.appendChild(el('span', null, 'Enter open'));
    foot.appendChild(el('span', null, 'Esc close'));
    const count = el('span', 'search-palette-count');
    foot.appendChild(count);
    box.appendChild(input);
    box.appendChild(list);
    box.appendChild(foot);
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closePalette(); });
    input.addEventListener('input', function() { runSearch(input.value); });
    input.addEventListener('keydown', onPaletteKey);
    return { overlay: overlay, input: input, list: list, count: count };
  }

  function select(i) {
    if (!rows.length) { selected = -1; return; }
    selected = (i + rows.length) % rows.length;
    rows.forEach(function(r, idx) {
      r.node.classList.toggle('selected', idx === selected);
      r.node.setAttribute('aria-selected', idx === selected ? 'true' : 'false');
    });
    rows[selected].node.scrollIntoView({ block: 'nearest' });
    palette.input.setAttribute('aria-activedescendant', rows[selected].node.id);
  }

  function addGroup(label, hits, query, showText) {
    if (!hits.length) return;
    palette.list.appendChild(el('div', 'search-palette-group', label));
    hits.forEach(function(h) {
      const e = h.entry;
      const a = el('a', 'search-palette-row');
      a.href = baseUrl + e.url;
      a.id = 'search-row-' + rows.length;
      a.setAttribute('role', 'option');
      const title = el('div', 'search-palette-title');
      fillHighlighted(title, e.title, query);
      a.appendChild(title);
      const trail = (e.path || []).join(' / ');
      if (trail) a.appendChild(el('div', 'search-palette-path', trail));
      const body = e.type === 'page' && !e.text ? (e.description || '') : e.text;
      if (showText && body) {
        const ex = el('div', 'search-palette-excerpt');
        fillHighlighted(ex, SearchCore.excerpt(body, query), query);
        a.appendChild(ex);
      }
      const idx = rows.length;
      a.addEventListener('mousemove', function() { if (selected !== idx) select(idx); });
      palette.list.appendChild(a);
      rows.push({ node: a, url: a.href });
    });
  }

  function runSearch(query) {
    const q = query.trim();
    palette.list.textContent = '';
    rows = [];
    selected = -1;
    palette.count.textContent = '';
    if (q.length < 2) {
      palette.list.appendChild(el('div', 'search-palette-empty', 'Type at least 2 characters. Use "quotes" for an exact phrase.'));
      return;
    }
    loadIndex().then(function(index) {
      if (palette.input.value.trim() !== q) return; // a newer search is running
      const res = SearchCore.search(index, q);
      palette.list.textContent = '';
      rows = [];
      addGroup('Pages', res.pages, q, true);
      addGroup('Sections', res.sections, q, true);
      if (!rows.length) {
        palette.list.appendChild(el('div', 'search-palette-empty', 'No results for "' + q + '". Try fewer or shorter words.'));
        return;
      }
      palette.count.textContent = rows.length + ' result' + (rows.length === 1 ? '' : 's');
      select(0);
    });
  }

  function onPaletteKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); select(selected + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(selected - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected >= 0 && rows[selected]) window.location.href = rows[selected].url;
    } else if (e.key === 'Tab') { e.preventDefault(); }
  }

  function openPalette(initial) {
    if (palette) return;
    lastFocus = document.activeElement;
    palette = buildPalette();
    document.body.appendChild(palette.overlay);
    document.body.classList.add('search-open');
    palette.input.value = initial || '';
    palette.input.focus();
    runSearch(palette.input.value);
    loadIndex();
  }

  function closePalette() {
    if (!palette) return;
    palette.overlay.remove();
    palette = null;
    rows = [];
    document.body.classList.remove('search-open');
    if (searchInput) searchInput.blur();
    if (lastFocus && lastFocus.focus && lastFocus !== searchInput) lastFocus.focus();
  }

  if (searchInput) {
    // The header box opens the search window; typing happens inside the window.
    searchInput.addEventListener('focus', function() { openPalette(searchInput.value); });
    searchInput.addEventListener('click', function() { openPalette(searchInput.value); });
  }

  // Ctrl+K / Cmd+K opens search; "/" does too when not typing in a field
  document.addEventListener('keydown', function(e) {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette) palette.input.select(); else openPalette('');
    } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openPalette('');
    }
  });

  // ============================================
  // Smooth Scroll for Anchor Links
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Update URL without jumping
        history.pushState(null, null, href);
      }
    });
  });

  // ============================================
  // Copy Code Blocks
  // ============================================
  document.querySelectorAll('pre.hljs').forEach(function(block) {
    // Create copy button
    const button = document.createElement('button');
    button.className = 'copy-code-btn';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    
    // Wrap pre in container
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);
    wrapper.appendChild(button);
    
    // Copy on click
    button.addEventListener('click', async function() {
      const code = block.querySelector('code');
      const text = code ? code.textContent : block.textContent;
      
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied!';
        button.classList.add('copied');
        
        setTimeout(function() {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        button.textContent = 'Failed';
        
        setTimeout(function() {
          button.textContent = 'Copy';
        }, 2000);
      }
    });
  });

})();


// "On this page" rail: mark the heading currently in view
(function() {
  const links = Array.from(document.querySelectorAll('.toc-list a'));
  if (!links.length) return;
  const byId = new Map();
  links.forEach(a => byId.set(decodeURIComponent(a.getAttribute('href').slice(1)), a));
  const headings = Array.from(byId.keys()).map(id => document.getElementById(id)).filter(Boolean);
  if (!headings.length) return;
  let queued = false;
  function update() {
    queued = false;
    // The current section is the last heading that has reached the top of the viewport
    const line = 96;
    let current = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h; else break;
    }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) current = headings[headings.length - 1];
    links.forEach(a => a.classList.toggle('active', byId.get(current.id) === a));
  }
  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
})();

// Header links: show as many as fit next to the search box; the rest go into a "More" menu.
(function() {
  const nav = document.querySelector('.header-links');
  if (!nav) return;
  const actions = nav.parentElement;
  const container = nav.closest('.header-container');
  const search = container && container.querySelector('.header-search');
  const items = Array.from(nav.querySelectorAll('.header-link'));
  if (!items.length || !search) return;

  const wrap = document.createElement('div');
  wrap.className = 'header-links-more';
  wrap.hidden = true;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'header-link header-links-more-btn';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'More links');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  const menu = document.createElement('div');
  menu.className = 'header-links-menu';
  menu.hidden = true;
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  actions.insertBefore(wrap, nav.nextSibling);

  function closeMenu() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function(e) { if (!wrap.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); btn.focus(); } });

  function fit() {
    closeMenu();
    items.forEach(function(a) { a.hidden = false; });
    wrap.hidden = true;
    const cs = getComputedStyle(container);
    const gap = parseFloat(getComputedStyle(actions).columnGap) || 8;
    const minSearch = window.innerWidth > 760 ? 240 : 150;
    let others = 0, kids = 0;
    Array.from(container.children).forEach(function(c) {
      if (c === actions || c === search || getComputedStyle(c).position === 'fixed' || getComputedStyle(c).display === 'none') return;
      others += c.offsetWidth; kids++;
    });
    const sm = getComputedStyle(search);
    const searchBox = minSearch + (parseFloat(sm.marginLeft) || 0) + (parseFloat(sm.marginRight) || 0);
    const fixedActions = Array.from(actions.children).filter(function(c) { return c !== nav && c !== wrap && getComputedStyle(c).display !== 'none'; })
      .reduce(function(s, c) { return s + c.offsetWidth + gap; }, 0);
    const room = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
      - others - kids * (parseFloat(cs.columnGap) || 0) - searchBox - fixedActions - ((parseFloat(cs.columnGap) || 0));
    const widths = items.map(function(a) { return a.offsetWidth + gap; });
    const moreW = 32 + gap;
    let used = 0, count = 0;
    for (let i = 0; i < items.length; i++) {
      const left = items.length - i - 1;
      if (used + widths[i] + (left > 0 ? moreW : 0) <= room) { used += widths[i]; count++; } else break;
    }
    items.forEach(function(a, i) { a.hidden = i >= count; });
    menu.textContent = '';
    if (count < items.length) {
      wrap.hidden = false;
      items.slice(count).forEach(function(a) {
        const c = a.cloneNode(true);
        c.hidden = false;
        c.className = 'header-menu-item';
        const label = c.querySelector('.header-link-label');
        if (label) label.className = 'header-menu-label';
        menu.appendChild(c);
      });
    }
  }
  let t = null;
  function later() { clearTimeout(t); t = setTimeout(fit, 60); }
  window.addEventListener('resize', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
})();
