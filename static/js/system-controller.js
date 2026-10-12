(function () {
  const $ = (id) => document.getElementById(id);
  let activityCursor = null,
    publishCursor = null,
    passwordDirty = false,
    passwordSaving = false;
  const events = [
    "login",
    "login-failed",
    "login-blocked",
    "logout",
    "password-changed",
    "user-created",
    "user-disabled",
    "user-enabled",
    "sections-changed",
    "section-renamed",
    "section-settings-saved",
    "password-reset",
    "sessions-ended",
    "links-saved",
    "site-settings-saved",
    "publish-started",
    "publish-done",
    "publish-failed",
  ];
  for (const event of events) {
    const o = document.createElement("option");
    o.value = event;
    o.textContent = event.replaceAll("-", " ");
    $("activityEvent").append(o);
  }
  async function api(url, body) {
    const r = await fetch(url, {
      credentials: "same-origin",
      ...(body
        ? {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": window.msCsrfToken,
            },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (r.status === 401) {
      location.href = "/login";
      throw Error("Sign in again");
    }
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }
  function row(host, label, value) {
    const r = document.createElement("div");
    r.className = "info-row";
    const l = document.createElement("strong");
    l.textContent = label;
    const v = document.createElement("span");
    v.textContent = value;
    r.append(l, v);
    host.append(r);
  }
  const when = (x) => (x ? new Date(x).toLocaleString() : "-");
  async function security() {
    try {
      const d = await api("/api/security");
      $("securityPolicy").replaceChildren();
      row(
        $("securityPolicy"),
        "Session limits",
        d.sessionIdleMinutes +
          " minutes idle / " +
          d.sessionMaxMinutes +
          " minutes maximum",
      );
      row(
        $("securityPolicy"),
        "Session cookie",
        d.cookie +
          "; HttpOnly; SameSite=Strict; " +
          (d.secure
            ? "Secure; HTTPS required"
            : "local HTTP mode (not production HTTPS)"),
      );
      row(
        $("securityPolicy"),
        "Raw HTML",
        d.rawHtmlEnabled
          ? "Enabled by server configuration"
          : "Disabled by server configuration",
      );
      row(
        $("securityPolicy"),
        "Access",
        "Assigned sections enforced server-side; administrator-only management; CSRF protected",
      );
      if (d.auditError)
        row($("securityPolicy"), "History storage warning", d.auditError);
      for (const [key, v] of Object.entries(d.rateLimits))
        row(
          $("securityPolicy"),
          key === "accountAddress"
            ? "Account + address"
            : key === "accountAll"
              ? "Account across addresses"
              : "Client address",
          v.maxFailures +
            " failures / " +
            v.windowMinutes +
            " minutes; pause " +
            v.blockMinutes +
            " minutes; " +
            v.blocked +
            " blocked groups now",
        );
      row(
        $("securityPolicy"),
        "Rate-limit state",
        "Memory-only counts, reset on server restart. No account/address keys exposed. Familiar successful addresses are exempt from the cross-address account pause.",
      );
    } catch (e) {
      $("securityStatus").textContent = e.message;
    }
  }
  function records(host, items, publishes) {
    for (const r of items) {
      const box = document.createElement("div");
      box.className = "card-content";
      row(box, when(r.at), r.event.replaceAll("-", " "));
      row(
        box,
        "Actor / target",
        (r.actor || "Unauthenticated/system") + " / " + (r.target || "-"),
      );
      if (publishes) {
        row(box, "Pages", r.publish.pages.done + " / " + r.publish.pages.total);
        row(
          box,
          "Started / finished",
          when(r.publish.startedAt) + " / " + when(r.publish.finishedAt),
        );
        if (r.publish.failedStage)
          row(box, "Failed stage", r.publish.failedStage);
      }
      host.append(box);
    }
  }
  async function activity(more = false) {
    try {
      const q = new URLSearchParams({
        event: $("activityEvent").value,
        actor: $("activityActor").value.trim(),
        target: $("activityTarget").value.trim(),
        limit: "50",
      });
      if (more && activityCursor) q.set("before", activityCursor);
      const d = await api("/api/activity?" + q);
      if (!more) $("activityRows").replaceChildren();
      records($("activityRows"), d.records, false);
      activityCursor = d.nextBefore;
      $("activityMore").hidden = !d.hasMore;
      $("activityStatus").textContent = d.records.length
        ? "Showing recorded events. Newest first."
        : "No matching recorded events.";
    } catch (e) {
      $("activityStatus").textContent = e.message;
    }
  }
  async function publishes(more = false) {
    try {
      const [d, current] = await Promise.all([
        api(
          "/api/publish/history?limit=25" +
            (more && publishCursor
              ? "&before=" + encodeURIComponent(publishCursor)
              : ""),
        ),
        api("/api/publish/status"),
      ]);
      if (!more) $("publishHistory").replaceChildren();
      records($("publishHistory"), d.records, true);
      publishCursor = d.nextBefore;
      $("publishMore").hidden = !d.hasMore;
      $("historyStatus").textContent = d.records.length
        ? "Recorded publishes. Newest first."
        : "No completed publish history yet.";
      $("systemPublishState").replaceChildren();
      row($("systemPublishState"), "State", current.state);
      row(
        $("systemPublishState"),
        "Saved changes",
        current.unpublished
          ? "Unpublished changes"
          : "Matches last editor publish",
      );
      if (current.pages)
        row(
          $("systemPublishState"),
          "Pages",
          current.pages.done + " / " + current.pages.total,
        );
      if (current.error) row($("systemPublishState"), "Error", current.error);
      row(
        $("systemPublishState"),
        "Details",
        "Use Publish Changes for staged progress and the full failure report.",
      );
    } catch (e) {
      $("historyStatus").textContent = e.message;
    }
  }
  $("activityFilter").onsubmit = (e) => {
    e.preventDefault();
    activity();
  };
  $("activityMore").onclick = () => activity(true);
  $("historyReload").onclick = () => publishes();
  $("publishMore").onclick = () => publishes(true);
  $("securityReload").onclick = security;
  $("historyPublish").onclick = () => {
    if (
      window.msUserDirty ||
      window.msContentDirty ||
      window.msSiteDirty ||
      passwordDirty
    ) {
      $("historyStatus").textContent =
        "Save or discard unsaved edits before publishing.";
      return;
    }
    $("publish-btn").click();
  };
  function clearPassword() {
    if (passwordSaving) return;
    for (const id of [
      "adminCurrentPassword",
      "adminNewPassword",
      "adminRepeatPassword",
    ])
      $(id).value = "";
    passwordDirty = false;
    window.msSystemDirty = false;
  }
  window.msDiscardSystem = clearPassword;
  $("adminPasswordForm").oninput = () => {
    passwordDirty = [
      "adminCurrentPassword",
      "adminNewPassword",
      "adminRepeatPassword",
    ].some((id) => $(id).value);
    window.msSystemDirty = passwordDirty;
  };
  $("adminPasswordForm").onsubmit = async (e) => {
    e.preventDefault();
    if (passwordSaving) return;
    if ($("adminNewPassword").value !== $("adminRepeatPassword").value) {
      $("securityStatus").textContent = "New passwords do not match.";
      return;
    }
    passwordSaving = true;
    window.msSystemSaving = true;
    for (const id of [
      "adminCurrentPassword",
      "adminNewPassword",
      "adminRepeatPassword",
    ])
      $(id).disabled = true;
    $("adminPasswordSave").disabled = true;
    $("securityStatus").textContent = "Changing password...";
    try {
      const d = await api("/api/change-password", {
        current: $("adminCurrentPassword").value,
        password: $("adminNewPassword").value,
      });
      window.msCsrfToken = d.csrf;
      passwordSaving = false;
      clearPassword();
      $("securityStatus").textContent =
        "Password changed. Your other sessions have ended.";
    } catch (err) {
      $("securityStatus").textContent = "Not changed: " + err.message;
    } finally {
      passwordSaving = false;
      window.msSystemSaving = false;
      for (const id of [
        "adminCurrentPassword",
        "adminNewPassword",
        "adminRepeatPassword",
      ])
        $(id).disabled = false;
      $("adminPasswordSave").disabled = false;
    }
  };
  window.msSystemRoute = (area) => {
    if (area === "security") security();
    if (area === "activity") activity();
    if (area === "publishes") publishes();
  };
  // Routing runs before this controller loads; honor a direct System bookmark.
  window.msSystemRoute(location.hash.split("/")[1]);
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[href="/"]'),
        out = e.target.closest("#signOut");
      if (!(a || out) || !(passwordDirty || passwordSaving)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (passwordSaving) return;
      window.msAsk("Discard the unsaved password form and leave?", () => {
        clearPassword();
        if (out) out.click();
        else location.href = "/";
      });
      $("askGo").textContent = "Discard";
    },
    true,
  );
})();
