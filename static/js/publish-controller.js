(function () {
  var btn = document.getElementById("publish-btn");
  var dot = document.getElementById("publish-dot");
  var ov = document.getElementById("publish-modal-overlay");
  var intro = document.getElementById("publish-intro");
  var warn = document.getElementById("publish-warn");
  var prog = document.getElementById("publish-progress");
  var bar = document.getElementById("publish-bar");
  var fill = document.getElementById("publish-bar-fill");
  var detail = document.getElementById("publish-detail");
  var steps = document.getElementById("publish-steps");
  var result = document.getElementById("publish-result");
  var rTitle = document.getElementById("publish-result-title");
  var rLive = document.getElementById("publish-live");
  var rErr = document.getElementById("publish-error");
  var logWrap = document.getElementById("publish-log-wrap");
  var logEl = document.getElementById("publish-log");
  var copyBtn = document.getElementById("publish-copy");
  var cancelBtn = document.getElementById("publish-cancel");
  var okBtn = document.getElementById("publish-confirm");
  var timer = null,
    diag = "",
    lastState = "idle";
  if (!btn) return;

  function api(method, url) {
    var h = { "Content-Type": "application/json" };
    var m = document.cookie.match(/(?:^|; )ms_csrf=([^;]*)/);
    if (window.msCsrfToken) h["X-CSRF-Token"] = window.msCsrfToken;
    else if (m) h["X-CSRF-Token"] = decodeURIComponent(m[1]);
    return fetch(url, {
      method: method,
      headers: h,
      credentials: "same-origin",
      body: method === "POST" ? "{}" : undefined,
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (b) {
          return { status: r.status, body: b };
        });
    });
  }
  function show(el, on) {
    el.hidden = !on;
  }
  window.msPublishState = function () {
    if (btn.hidden) return Promise.resolve(null);
    return api("GET", "/api/publish/status").then(function (r) {
      if (r.status !== 200) return null;
      show(dot, !!r.body.unpublished && r.body.state !== "running");
      return r.body.unpublished === true
        ? true
        : r.body.unpublished === false
          ? false
          : null;
    });
  };
  function openModal() {
    ov.classList.add("visible");
  }
  function closeModal() {
    ov.classList.remove("visible");
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function render(st) {
    show(dot, !!st.unpublished && st.state !== "running");
    if (st.state === "idle" || !st.stages) return;
    show(prog, true);
    show(intro, false);
    steps.textContent = "";
    var done = 0,
      current = null;
    st.stages.forEach(function (s) {
      var li = document.createElement("li");
      li.className = s.state;
      li.textContent =
        s.label +
        (s.key === "build" &&
        st.pages &&
        st.pages.total &&
        s.state !== "pending"
          ? " (" + st.pages.done + " of " + st.pages.total + " pages)"
          : "");
      steps.appendChild(li);
      if (s.state === "done") done++;
      if (s.state === "running" || s.state === "failed") current = s;
    });
    var frac = 0;
    if (current && current.key === "build" && st.pages && st.pages.total)
      frac = Math.min(1, st.pages.done / st.pages.total);
    var pct = Math.round(((done + frac) / st.stages.length) * 100);
    if (st.state === "done") pct = 100;
    fill.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(pct));
    bar.classList.toggle("failed", st.state === "failed");
    detail.textContent =
      st.state === "running" && current
        ? current.label +
          "... (you can hide this window; the publish keeps running)"
        : "";
    if (st.state === "running") cancelBtn.textContent = "Hide progress";
    if (st.state === "done" || st.state === "failed") {
      show(result, true);
      rTitle.textContent =
        st.state === "done"
          ? "Build published. " + st.pages.done + " pages generated."
          : "Publish failed at: " + (st.failedStage || "unknown step");
      rLive.textContent = st.live || "";
      show(rErr, st.state === "failed");
      rErr.textContent = st.error || "";
      show(logWrap, st.state === "failed" && st.log && st.log.length > 0);
      logEl.textContent = (st.log || []).join("\n");
      diag = st.diagnostics || "";
      show(copyBtn, st.state === "failed" && !!diag);
      okBtn.hidden = true;
      cancelBtn.textContent = "Close";
    }
  }

  function poll() {
    api("GET", "/api/publish/status")
      .then(function (r) {
        if (r.status !== 200) return;
        render(r.body);
        lastState = r.body.state;
        if (r.body.state === "running") timer = setTimeout(poll, 400);
        else timer = null;
      })
      .catch(function () {
        timer = setTimeout(poll, 1500);
      });
  }

  function resetView(st) {
    show(prog, false);
    show(result, false);
    show(warn, false);
    show(intro, true);
    copyBtn.hidden = true;
    okBtn.hidden = false;
    okBtn.disabled = false;
    cancelBtn.textContent = "Cancel";
    intro.textContent =
      "This rebuilds the whole site from every saved file, including pages saved by other editors, and replaces the live docs. The current live version is kept as a backup. If the build fails, the live site stays as it is.";
    var lines = [];
    if (st && st.unpublished === false)
      lines.push("There are no saved changes newer than the published site.");
    if (window.msHasUnsavedChanges && window.msHasUnsavedChanges())
      lines.push(
        "The file open in the editor has unsaved edits. Save it first, or those edits will not be published.",
      );
    if (lines.length) {
      warn.textContent = lines.join(" ");
      show(warn, true);
    }
  }

  btn.addEventListener("click", function () {
    api("GET", "/api/publish/status").then(function (r) {
      if (r.status !== 200) return;
      if (r.body.state === "running") {
        resetView(r.body);
        okBtn.hidden = true;
        openModal();
        render(r.body);
        poll();
        return;
      }
      resetView(r.body);
      openModal();
      okBtn.focus();
    });
  });
  cancelBtn.addEventListener("click", closeModal);
  ov.addEventListener("click", function (e) {
    if (e.target === ov && lastState !== "running") closeModal();
  });
  okBtn.addEventListener("click", function () {
    okBtn.disabled = true;
    api("POST", "/api/publish")
      .then(function (r) {
        if (r.status === 200 || r.status === 409) {
          show(warn, false);
          okBtn.hidden = true;
          poll();
        } else {
          warn.textContent =
            "Could not start the publish: " +
            ((r.body && r.body.error) || "HTTP " + r.status);
          show(warn, true);
          okBtn.disabled = false;
        }
      })
      .catch(function (e) {
        warn.textContent = "Could not start the publish: " + e.message;
        show(warn, true);
        okBtn.disabled = false;
      });
  });
  copyBtn.addEventListener("click", function () {
    var done = function () {
      copyBtn.textContent = "Copied";
      setTimeout(function () {
        copyBtn.textContent = "Copy diagnostics";
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(diag).then(done, function () {
        fallbackCopy();
      });
    else fallbackCopy();
    function fallbackCopy() {
      var t = document.createElement("textarea");
      t.value = diag;
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        /* ignore */
      }
      document.body.removeChild(t);
    }
  });

  // Only administrators get the button; the status call tells us who we are.
  api("GET", "/api/publish/status")
    .then(function (r) {
      if (r.status !== 200) return;
      btn.hidden = false;
      show(dot, !!r.body.unpublished);
      if (r.body.state === "running") {
        resetView(r.body);
        okBtn.hidden = true;
        openModal();
        render(r.body);
        poll();
      }
    })
    .catch(function () {});
})();
