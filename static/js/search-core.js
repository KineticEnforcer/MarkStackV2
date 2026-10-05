/**
 * Search core: matching and ranking for the documentation search.
 * Plain functions with no DOM access, so they run in the browser and in tests.
 * Index entries: { type: 'page'|'section', title, url, path: [string], text }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SearchCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function words(s) {
    return normalize(s).match(/[a-z0-9\u0080-\uffff]+/g) || [];
  }

  /** Split a query into terms and "quoted phrases". */
  function parseQuery(q) {
    const phrases = [];
    const rest = String(q || '').replace(/"([^"]+)"/g, function (_, p) {
      const w = words(p).join(' ');
      if (w) phrases.push(w);
      return ' ';
    });
    return { terms: words(rest), phrases: phrases };
  }

  /** True when a and b differ by at most max single-character edits. */
  function withinEdits(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    let prev2 = null;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > max) return false;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length] <= max;
  }

  /** How well one query term matches one word: 3 exact, 2 prefix, 1 typo, 0 none. */
  function matchWord(term, word) {
    if (word === term) return 3;
    if (word.startsWith(term)) return 2;
    if (term.length >= 5) {
      const max = term.length >= 9 ? 2 : 1;
      if (withinEdits(term, word, max)) return 1;
      if (withinEdits(term, word.slice(0, term.length), max)) return 1;
    }
    return 0;
  }

  function bestMatch(term, wordList) {
    let best = 0;
    for (let i = 0; i < wordList.length && best < 3; i++) {
      const m = matchWord(term, wordList[i]);
      if (m > best) best = m;
    }
    return best;
  }

  /** Add lowercase word lists to each entry once, after the index loads. */
  function prepare(entries) {
    return entries.map(function (e) {
      return Object.assign({}, e, {
        _title: words(e.title),
        _path: words((e.path || []).join(' ')),
        _text: Array.from(new Set(words(e.text))),
        _flat: normalize(e.title + ' ' + (e.text || ''))
      });
    });
  }

  function scoreEntry(e, q) {
    let score = 0;
    for (const term of q.terms) {
      const t = bestMatch(term, e._title);
      const p = bestMatch(term, e._path);
      const x = bestMatch(term, e._text);
      if (!t && !p && !x) return 0; // every typed word must match somewhere
      score += t * 10 + p * 3 + x;
    }
    for (const phrase of q.phrases) {
      if (e._flat.indexOf(phrase) === -1) return 0;
      score += 15;
      if (normalize(e.title).indexOf(phrase) !== -1) score += 15;
    }
    if (q.terms.length && normalize(e.title) === q.terms.join(' ')) score += 20;
    if (e.type === 'page') score += 2;
    return score;
  }

  /** Returns { pages, sections } ranked, each capped. */
  function search(prepared, query, limits) {
    const lim = Object.assign({ pages: 6, sections: 8 }, limits);
    const q = parseQuery(query);
    if (!q.terms.length && !q.phrases.length) return { pages: [], sections: [] };
    if (q.terms.length === 1 && q.terms[0].length < 2 && !q.phrases.length) return { pages: [], sections: [] };
    const hits = [];
    for (const e of prepared) {
      const s = scoreEntry(e, q);
      if (s > 0) hits.push({ entry: e, score: s });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return {
      pages: hits.filter(function (h) { return h.entry.type === 'page'; }).slice(0, lim.pages),
      sections: hits.filter(function (h) { return h.entry.type !== 'page'; }).slice(0, lim.sections)
    };
  }

  /** Character ranges of text that match the query, for highlighting. */
  function highlightRanges(text, query) {
    const q = parseQuery(query);
    const exact = [].concat(...q.phrases.map(function (p) { return p.split(' '); }));
    const ranges = [];
    const re = /[A-Za-z0-9\u0080-\uffff]+/g;
    let m;
    while ((m = re.exec(text))) {
      const w = normalize(m[0]);
      if (exact.indexOf(w) !== -1) { ranges.push([m.index, m.index + m[0].length]); continue; }
      for (const term of q.terms) {
        if (matchWord(term, w)) {
          // Highlight only the matching start of a prefix match, the whole word otherwise.
          const len = w.startsWith(term) ? term.length : m[0].length;
          ranges.push([m.index, m.index + len]);
          break;
        }
      }
    }
    return ranges;
  }

  /** A short piece of text around the first match. */
  function excerpt(text, query, size) {
    const n = size || 150;
    const t = String(text || '');
    const q = parseQuery(query);
    let ranges = highlightRanges(t, query);
    // Centre on an exact phrase when there is one
    const flat = normalize(t);
    for (const p of q.phrases) {
      const at = flat.indexOf(p);
      if (at !== -1) { ranges = [[at, at + p.length]].concat(ranges); break; }
    }
    if (!ranges.length) return t.length > n ? t.slice(0, n).trim() + '...' : t;
    const start = Math.max(0, ranges[0][0] - 50);
    const end = Math.min(t.length, start + n);
    return (start > 0 ? '...' : '') + t.slice(start, end).trim() + (end < t.length ? '...' : '');
  }

  return { normalize, words, parseQuery, withinEdits, matchWord, prepare, search, highlightRanges, excerpt };
});
