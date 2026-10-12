// Load the local diagram library only when a diagram needs rendering.
(function () {
  'use strict';
  const script = document.currentScript;
  const url = new URL('../vendor/mermaid.js', script.src).href;
  let pending;
  window.msLoadMermaid = function () {
    if (!pending) pending = new Promise(function (resolve, reject) {
      const tag = document.createElement('script');
      tag.src = url;
      tag.onload = function () { resolve(window.MarkStackMermaid.default); };
      tag.onerror = function () { pending = null; tag.remove(); reject(new Error('Local diagram library could not load')); };
      document.head.appendChild(tag);
    });
    return pending;
  };
  if (script.dataset.public !== 'true') return;
  let rendering = Promise.resolve();
  function render() {
    if (!document.querySelector('pre.mermaid')) return;
    rendering = rendering.catch(function () {}).then(async function () {
      const mermaid = await window.msLoadMermaid();
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', fontFamily: 'IBM Plex Sans', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
      await document.fonts.ready;
      for (const block of document.querySelectorAll('pre.mermaid')) {
        if (!block.dataset.code) block.dataset.code = block.textContent;
        try {
          const result = await mermaid.render('diagram-' + crypto.randomUUID(), block.dataset.code);
          block.innerHTML = result.svg;
        } catch (e) { block.textContent = 'Mermaid syntax error: ' + e.message; }
      }
    }).catch(function (e) { console.error(e); });
  }
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
