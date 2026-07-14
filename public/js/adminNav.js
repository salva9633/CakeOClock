(function () {
  const contentEl = document.getElementById("page-content");
  if (!contentEl) return;

  // ── Track timers started by page scripts so we can kill them
  //    before the next navigation swaps the content out ──
  window.__adminPageTimers = window.__adminPageTimers || [];

  const _setInterval = window.setInterval;
  window.setInterval = function (...args) {
    const id = _setInterval.apply(window, args);
    window.__adminPageTimers.push(id);
    return id;
  };

  function clearPageTimers() {
    window.__adminPageTimers.forEach((id) => clearInterval(id));
    window.__adminPageTimers = [];
  }

  function isInternalAdminLink(link) {
    if (!link) return false;
    if (link.target === "_blank") return false;
    if (link.hasAttribute("download")) return false;
    if (link.dataset.noAjax !== undefined) return false;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return false;
    if (/^https?:\/\//.test(href) && !href.includes(location.host)) return false;
    if (!href.startsWith("/admin")) return false;
    return true;
  }

  async function navigate(url, { pushState = true } = {}) {
  clearPageTimers();
  contentEl.style.opacity = "0.6";
  try {
    const res = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });

    if (res.redirected) {
      window.location.href = res.url;
      return;
    }

    if (!res.ok) {
      console.error(`Admin nav request failed: ${res.status} ${res.statusText} for ${url}`);
      contentEl.innerHTML = renderInlineError(res.status, url);
      if (pushState) history.pushState({ ajaxUrl: url }, "", url);
      window.scrollTo(0, 0);          // ← add this
      return;
    }

    const html = await res.text();
    contentEl.innerHTML = html;

    if (pushState) history.pushState({ ajaxUrl: url }, "", url);

    window.scrollTo(0, 0);            // ← add this — the actual fix

    updateActiveSidebar(url);
await runInlineScripts(contentEl); 
  } catch (err) {
    console.error("Admin AJAX nav failed, falling back to full reload:", err);
    window.location.href = url;
  } finally {
    contentEl.style.opacity = "1";
  }
}

function renderInlineError(status, url) {
  if (status >= 500) {
    return `<div class="admin-error">
      <h2>Something went wrong (${status})</h2>
      <p>The server hit an error loading <code>${url}</code>. Try again, or check the server logs.</p>
      <button onclick="window.adminNavigate(location.pathname)">Retry</button>
    </div>`;
  }
  return `<div class="admin-error">
    <h2>Not found (${status})</h2>
    <p>The page you're looking for doesn't exist.</p>
  </div>`;
}

  function updateActiveSidebar(url) {
    const path = new URL(url, location.origin).pathname;
    document.querySelectorAll(".sidebar .menu-item").forEach((item) => {
      const href = item.getAttribute("href");
      item.classList.toggle(
        "active",
        href && (path === href || (path.startsWith(href) && href !== "/admin"))
      );
    });
  }

  async function runInlineScripts(container) {
    const scripts = [...container.querySelectorAll("script")];
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      [...oldScript.attributes].forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );

      if (oldScript.src) {
        await new Promise((resolve) => {
          newScript.onload  = resolve;
          newScript.onerror = resolve;
          oldScript.replaceWith(newScript);
        });
        continue;
      }

      // Wrap in an IIFE so top-level const/let never collide
      // with the same page's script running from a previous visit
      newScript.textContent = `(function(){\n${oldScript.textContent}\n})();`;
      oldScript.replaceWith(newScript);
    }
    document.dispatchEvent(new CustomEvent("admin:content-loaded", { detail: { container } }));
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!isInternalAdminLink(link)) return;
    e.preventDefault();
    const href = link.getAttribute("href");
    if (href === location.pathname + location.search) return;
    navigate(href);
  });
window.addEventListener("popstate", () => {
    navigate(location.pathname + location.search, { pushState: false });
  });

  // Expose navigate() so page-level scripts (search boxes, filters, etc.)
  // can trigger AJAX navigation too, not just sidebar link clicks.
  window.adminNavigate = navigate;
})();