(function () {
  const $ = (id) => document.getElementById(id),
    names = {
      siteTitle: "Site title",
      headerTitle: "Header title",
      siteSubtitle: "Subtitle",
      defaultDescription: "Default description",
      siteUrl: "Site URL",
    };
  let saved = null,
    revision = null,
    busy = false;
  for (const [key, label] of Object.entries(names)) {
    const l = document.createElement("label");
    l.htmlFor = "setting-" + key;
    l.textContent = label;
    const i = document.createElement("input");
    i.id = "setting-" + key;
    i.maxLength = {
      siteTitle: 120,
      headerTitle: 80,
      siteSubtitle: 300,
      defaultDescription: 300,
      siteUrl: 2000,
    }[key];
    i.addEventListener("input", dirty);
    $("siteFields").append(l, i);
  }
  function values() {
    const next = {};
    for (const key of Object.keys(names)) next[key] = $("setting-" + key).value;
    next.showHero = $("siteHero").checked;
    return next;
  }
  function message(text) {
    $("siteStatus").textContent = $("appearanceStatus").textContent = text;
  }
  function controls() {
    for (const id of [
      "siteSave",
      "siteDiscard",
      "appearanceSave",
      "appearanceDiscard",
    ])
      $(id).disabled = busy || !window.msSiteDirty;
    for (const key of Object.keys(names)) $("setting-" + key).disabled = busy;
    $("siteHero").disabled = busy;
  }
  function dirty() {
    window.msSiteDirty =
      !!saved && JSON.stringify(values()) !== JSON.stringify(saved);
    controls();
    message(
      window.msSiteDirty
        ? "Unsaved settings. Publish after saving."
        : "Saved settings apply after Publish Changes.",
    );
  }
  function restore() {
    if (!saved || busy) return;
    for (const key of Object.keys(names))
      $("setting-" + key).value = saved[key];
    $("siteHero").checked = saved.showHero;
    window.msSiteDirty = false;
    controls();
    message("Saved settings apply after Publish Changes.");
  }
  window.msDiscardSite = restore;
  $("siteHero").onchange = dirty;
  $("siteDiscard").onclick = $("appearanceDiscard").onclick = restore;
  async function load() {
    const r = await fetch("/api/site-settings", { credentials: "same-origin" }),
      d = await r.json();
    if (!r.ok) throw Error(d.error || "Could not load settings");
    saved = d.settings;
    revision = d.revision;
    restore();
    $("rawHtmlState").textContent =
      "Raw HTML: " +
      (d.rawHtmlEnabled ? "enabled" : "disabled") +
      " (server-only)";
    message("Saved settings apply after Publish Changes.");
  }
  async function save() {
    if (busy) return;
    busy = true;
    window.msSiteSaving = true;
    controls();
    message("Saving...");
    try {
      const r = await fetch("/api/site-settings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.msCsrfToken,
        },
        body: JSON.stringify({ settings: values(), revision }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Request failed");
      saved = d.settings;
      revision = d.revision;
      busy = false;
      window.msSiteSaving = false;
      restore();
      message("Saved. Publish Changes to update the site.");
      window.msPublishState();
    } catch (e) {
      busy = false;
      window.msSiteSaving = false;
      controls();
      message("Not saved: " + e.message);
    }
  }
  $("siteSave").onclick = $("appearanceSave").onclick = save;
  document.addEventListener(
    "click",
    function (e) {
      const a = e.target.closest('a[href="/"]'),
        out = e.target.closest("#signOut");
      if (!(a || out)) return;
      if (window.msSiteSaving) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (window.msSiteDirty) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.msAsk("Discard unsaved site settings and leave?", () => {
          restore();
          if (out) out.click();
          else location.href = "/";
        });
        $("askGo").textContent = "Discard";
      }
    },
    true,
  );
  load().catch((e) => message(e.message));
})();
