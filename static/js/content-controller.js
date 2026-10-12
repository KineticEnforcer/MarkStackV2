(function () {
  const $ = (id) => document.getElementById(id);
  let catalog = { sections: [], pages: [] },
    users = [],
    selected = null,
    page = null,
    tab = "settings",
    busy = false,
    area = location.hash.split("/")[1] || "users";
  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  async function api(method, url, body) {
    const r = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(method === "GET" ? {} : { "X-CSRF-Token": window.msCsrfToken }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }
  function status(text) {
    $("sectionStatus").textContent = text;
    if (area === "pages") $("pageStatus").textContent = text;
  }
  function dirty() {
    if (!selected) return;
    window.msContentDirty =
      $("sectionDisplayTitle").value !== selected.title ||
      $("sectionFolder").value !== selected.name ||
      Number($("sectionOrder").value) !== selected.order ||
      $("sectionHidden").checked !== selected.hidden;
    controls();
    status(
      window.msContentDirty
        ? "Unsaved section settings. Publish after saving."
        : "Settings apply after Publish Changes.",
    );
  }
  function controls() {
    [
      "sectionDisplayTitle",
      "sectionFolder",
      "sectionOrder",
      "sectionHidden",
      "sectionSave",
      "sectionDiscard",
    ].forEach(
      (id) =>
        ($(id).disabled =
          busy ||
          ((id === "sectionSave" || id === "sectionDiscard") &&
            !window.msContentDirty)),
    );
  }
  function guard(fn) {
    if (busy || window.msUserSaving) return;
    if (window.msContentDirty) {
      window.msAsk("Discard unsaved section changes?", () => {
        window.msDiscardContent();
        fn();
      });
      $("askGo").textContent = "Discard";
    } else if (window.msUserDirty) {
      window.msAsk("Discard unsaved access changes?", () => {
        window.msDiscardUser();
        fn();
      });
      $("askGo").textContent = "Discard";
    } else fn();
  }
  function row(title, subtitle, active, fn) {
    const r = el("button", undefined, "user-row" + (active ? " selected" : ""));
    r.type = "button";
    const avatar = el("span", title.slice(0, 2).toUpperCase(), "avatar");
    const text = el("span", undefined, "row-text");
    text.append(el("strong", title), el("span", subtitle, "muted"));
    r.append(avatar, text);
    r.onclick = () => guard(fn);
    return r;
  }
  function list() {
    const sr = $("sectionRows"),
      pr = $("pageRows");
    sr.textContent = pr.textContent = "";
    const sq = $("sectionSearch").value.toLowerCase(),
      pq = $("pageSearch").value.toLowerCase();
    catalog.sections
      .filter((s) => (s.title + " " + s.name).toLowerCase().includes(sq))
      .forEach((s) =>
        sr.append(
          row(
            s.title,
            s.pageCount +
              " pages · " +
              s.editors.length +
              " editors" +
              (s.hidden ? " · Hidden" : ""),
            selected && selected.name === s.name,
            () => select(s),
          ),
        ),
      );
    catalog.pages
      .filter((p) => (p.title + " " + p.path).toLowerCase().includes(pq))
      .forEach((p) =>
        pr.append(
          row(p.title, p.path, page && page.path === p.path, () =>
            selectPage(p),
          ),
        ),
      );
    if (!sr.childNodes.length)
      sr.append(el("p", "No matching sections.", "empty"));
    if (!pr.childNodes.length)
      pr.append(el("p", "No matching pages.", "empty"));
    $("sectionsCount").textContent = catalog.sections.length;
    $("pagesCount").textContent = catalog.pages.length;
  }
  function select(s) {
    selected = s;
    window.msContentDirty = false;
    $("sectionTitle").textContent = s.title;
    $("sectionMeta").textContent =
      s.name +
      " · " +
      s.pageCount +
      " pages · " +
      s.editors.length +
      " editors";
    $("sectionDisplayTitle").value = s.title;
    $("sectionFolder").value = s.name;
    $("sectionOrder").value = s.order;
    $("sectionHidden").checked = s.hidden;
    $("sectionDetail").hidden = false;
    document.body.classList.add("detail-open");
    dirty();
    list();
    switchTab(tab);
    renderEditors();
    renderSectionPages();
  }
  window.msDiscardContent = () => {
    if (!busy && selected) select(selected);
  };
  function switchTab(t) {
    tab = t;
    ["settings", "editors", "pages"].forEach((x) => {
      $("section" + x[0].toUpperCase() + x.slice(1)).hidden = x !== t;
      document
        .querySelector("[data-section-tab=" + x + "]")
        .classList.toggle("active", x === t);
    });
    $("sectionFooter").hidden = t !== "settings";
  }
  function renderEditors() {
    const box = $("sectionEditors");
    box.textContent = "";
    const card = el("div", undefined, "card");
    card.append(el("h2", "Assigned editors"));
    users
      .filter((u) => u.role === "editor")
      .forEach((u) => {
        const r = el("div", undefined, "access-row"),
          label = el("label"),
          cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = u.sections.includes(selected.name);
        label.append(
          cb,
          el("span", u.name + (u.disabled ? " (disabled)" : "")),
        );
        r.append(
          label,
          el("span", "Changing assignment ends sessions.", "muted"),
        );
        cb.onchange = () => {
          const target = selected.name,
            wanted = cb.checked;
          cb.checked = !wanted;
          guard(() => {
            window.msAsk(
              (wanted ? "Give " : "Remove ") +
                u.name +
                (wanted ? " access to " : " access from ") +
                target +
                "? Sessions end immediately.",
              async () => {
                cb.disabled = true;
                const note = el("p", "Saving access...", "muted");
                box.append(note);
                try {
                  const next = wanted
                    ? Array.from(new Set(u.sections.concat(target)))
                    : u.sections.filter((s) => s !== target);
                  await api("POST", "/api/users/sections", {
                    name: u.name,
                    sections: next,
                  });
                  await load();
                  box.append(el("p", "Access saved. Sessions ended.", "muted"));
                } catch (e) {
                  box.append(el("p", e.message, "err"));
                  cb.disabled = false;
                }
              },
            );
            $("askGo").textContent = "Apply";
          });
        };
        card.append(r);
      });
    if (!users.some((u) => u.role === "editor"))
      card.append(
        el("p", "No editor accounts. Add one in Users.", "card-content muted"),
      );
    box.append(
      card,
      el(
        "p",
        "Administrators always have access to all sections. Assignments apply immediately, not on publish.",
        "muted",
      ),
    );
  }
  function renderSectionPages() {
    const box = $("sectionPages");
    box.textContent = "";
    catalog.pages
      .filter((p) => p.section === selected.name)
      .forEach((p) => {
        const a = el("button", p.title + " · " + p.path, "user-row");
        a.onclick = () =>
          guard(() => {
            location.hash = "#/pages";
            selectPage(p);
          });
        box.append(a);
      });
  }
  function selectPage(p) {
    page = p;
    list();
    $("pageTitle").textContent = p.title;
    $("pageMeta").textContent = p.path;
    $("pageOpen").href = "/?file=" + encodeURIComponent(p.path);
    $("pageDetail").hidden = false;
    document.body.classList.add("detail-open");
    const card = $("pageInfo");
    card.textContent = "";
    card.append(el("h2", "Page details"));
    [
      ["Path", p.path],
      ["Public URL", p.url],
      ["Section", p.section || "Top level"],
      ["Modified", new Date(p.modifiedAt).toLocaleString()],
    ].forEach((pair) => {
      const r = el("div", undefined, "info-row");
      r.append(el("span", pair[0], "muted"), el("span", pair[1]));
      card.append(r);
    });
    $("pageStatus").textContent = "";
  }
  let loadSeq = 0;
  async function load() {
    const seq = ++loadSeq;
    const c = await api("GET", "/api/content-catalog");
    const u = await api("GET", "/api/users");
    if (seq !== loadSeq) return;
    catalog = c;
    users = u.users;
    list();
    if (selected) {
      const s = c.sections.find((x) => x.name === selected.name);
      if (s && !window.msContentDirty) select(s);
      else if (!s) {
        selected = null;
        $("sectionDetail").hidden = true;
      }
    } else if (c.sections[0]) {
      select(c.sections[0]);
      if (area !== "sections") document.body.classList.remove("detail-open");
    } else $("sectionDetail").hidden = true;
    if (page) {
      const p = c.pages.find((x) => x.path === page.path);
      if (p) selectPage(p);
      else $("pageDetail").hidden = true;
    } else if (c.pages[0]) {
      selectPage(c.pages[0]);
      if (area !== "pages") document.body.classList.remove("detail-open");
    } else $("pageDetail").hidden = true;
  }
  window.msContentRoute = function (next) {
    area = next;
    document.body.classList.remove("detail-open");
    if (next === "sections" || next === "pages")
      load().catch((e) => status(e.message));
  };
  [
    "sectionDisplayTitle",
    "sectionFolder",
    "sectionOrder",
    "sectionHidden",
  ].forEach((id) => ($(id).oninput = dirty));
  $("sectionDiscard").onclick = window.msDiscardContent;
  document
    .querySelectorAll("[data-section-tab]")
    .forEach((b) => (b.onclick = () => switchTab(b.dataset.sectionTab)));
  $("sectionSave").onclick = function () {
    if (!selected || busy) return;
    const original = selected,
      settings = {
        name: selected.name,
        title: $("sectionDisplayTitle").value,
        order: Number($("sectionOrder").value),
        hidden: $("sectionHidden").checked,
        revision: selected.revision,
      },
      newName = $("sectionFolder").value.trim();
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(newName)) {
      status(
        "Folder name must use lowercase letters, digits, dash or underscore.",
      );
      return;
    }
    const changedUrl =
      settings.title !== selected.title || newName !== selected.name;
    const save = async () => {
      busy = true;
      window.msContentSaving = true;
      controls();
      status("Saving...");
      try {
        const d = await api("POST", "/api/sections/settings", settings);
        original.title = settings.title;
        original.order = settings.order;
        original.hidden = settings.hidden;
        original.revision = d.revision;
        if (newName !== original.name) {
          try {
            const r = await api("POST", "/api/rename", {
              oldPath: original.name,
              newName,
              isFolder: true,
            });
            original.name = r.newPath;
          } catch (e) {
            window.msContentDirty = true;
            throw Error(
              "Settings saved, but folder rename failed: " + e.message,
            );
          }
        }
        window.msContentDirty = false;
        busy = false;
        window.msContentSaving = false;
        await load();
        status("Saved. Publish Changes to update the site.");
        window.msPublishState();
      } catch (e) {
        busy = false;
        window.msContentSaving = false;
        controls();
        status("Not completed: " + e.message);
      }
    };
    if (changedUrl) {
      window.msAsk(
        "Save these changes? Titles can change public URLs. Folder renames update editor access and end affected sessions. Browser-local drafts keep their old paths.",
        save,
      );
      $("askGo").textContent = "Save";
    } else save();
  };
  $("sectionSearch").oninput = list;
  $("pageSearch").oninput = list;
  $("sectionBack").onclick = $("pageBack").onclick = () =>
    guard(() => document.body.classList.remove("detail-open"));
  let inputTask = null;
  function inputDialog(title, name, parent, hint, task) {
    $("contentInputTitle").textContent = title;
    $("contentInputName").value = name;
    $("contentInputHint").textContent = hint;
    $("contentInputStatus").textContent = "";
    $("contentParentRow").hidden = !parent;
    const options = $("contentParent");
    options.textContent = "";
    const top = document.createElement("option");
    top.value = "";
    top.textContent = "/ (top level)";
    options.append(top);
    catalog.sections.forEach((s) => {
      const o = document.createElement("option");
      o.value = s.name;
      o.textContent = s.title + " (" + s.name + ")";
      options.append(o);
    });
    inputTask = task;
    $("contentInputGo").textContent = title.startsWith("Rename")
      ? "Rename"
      : "Create";
    $("contentInputDlg").showModal();
    $("contentInputName").focus();
  }
  $("contentInputCancel").onclick = () => $("contentInputDlg").close();
  $("contentInputForm").onsubmit = async (e) => {
    e.preventDefault();
    const go = $("contentInputGo");
    go.disabled = true;
    $("contentInputCancel").disabled = true;
    $("contentInputStatus").textContent = "Saving...";
    try {
      await inputTask(
        $("contentInputName").value.trim(),
        $("contentParent").value,
      );
      $("contentInputDlg").close();
      await load();
      window.msPublishState();
    } catch (err) {
      $("contentInputStatus").textContent = "Not saved: " + err.message;
    } finally {
      go.disabled = false;
      $("contentInputCancel").disabled = false;
    }
  };
  $("sectionNew").onclick = () =>
    guard(() =>
      inputDialog(
        "New section",
        "",
        false,
        "Creates a top-level section with _index.md. Publish to make it live.",
        async (name) => {
          const d = await api("POST", "/api/create-folder", {
            parentPath: "",
            name,
          });
          selected = { name: d.path };
        },
      ),
    );
  $("pageNew").onclick = () =>
    guard(() =>
      inputDialog(
        "New page",
        "new-page.md",
        true,
        "Creates a Markdown file. Its title determines the public URL.",
        async (name, parentPath) => {
          const d = await api("POST", "/api/create-file", { parentPath, name });
          page = { path: d.path };
        },
      ),
    );
  $("pageOpen").addEventListener("click", (e) => {
    if (window.msContentDirty || window.msUserDirty) {
      e.preventDefault();
      const href = e.currentTarget.href;
      guard(() => (location.href = href));
    }
  });
  $("pageRename").onclick = () =>
    guard(() => {
      if (page)
        inputDialog(
          "Rename page file",
          page.path.split("/").pop(),
          false,
          "A file rename can change its URL when it has no explicit frontmatter title. Existing browser drafts keep their old path.",
          async (newName) => {
            const d = await api("POST", "/api/rename", {
              oldPath: page.path,
              newName,
              isFolder: false,
            });
            page = { path: d.newPath };
          },
        );
    });
  $("pageDelete").onclick = () =>
    guard(() => {
      if (!page) return;
      const target = page.path;
      window.msAsk(
        "Permanently delete " +
          target +
          "? This cannot be undone here. Publish removes it from the site.",
        async () => {
          try {
            await api(
              "DELETE",
              "/api/delete?path=" + encodeURIComponent(target),
            );
            page = null;
            await load();
            window.msPublishState();
            $("pageStatus").textContent = "Page deleted.";
          } catch (e) {
            $("pageStatus").textContent = e.message;
          }
        },
      );
      $("askGo").textContent = "Delete";
    });
  // Wait for authenticated shell initialization, then load the current deep link.
  const started = fetch("/api/me", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((d) => {
      window.msCsrfToken = d.csrf;
      return load();
    })
    .catch((e) => status(e.message));
  started.then(() => {
    area = location.hash.split("/")[1] || "users";
  });
})();
