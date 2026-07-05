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

      if (res.redirected || !res.ok) {
        window.location.href = res.url || url;
        return;
      }

      const html = await res.text();
      contentEl.innerHTML = html;

      if (pushState) history.pushState({ ajaxUrl: url }, "", url);

      updateActiveSidebar(url);
      runInlineScripts(contentEl);
    } catch (err) {
      console.error("Admin AJAX nav failed, falling back to full reload:", err);
      window.location.href = url;
    } finally {
      contentEl.style.opacity = "1";
    }
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

  function runInlineScripts(container) {
    container.querySelectorAll("script").forEach((oldScript) => {
      const newScript = document.createElement("script");
      [...oldScript.attributes].forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );

      if (oldScript.src) {
        oldScript.replaceWith(newScript);
        return;
      }

      // Wrap in an IIFE so top-level const/let never collide
      // with the same page's script running from a previous visit
      newScript.textContent = `(function(){\n${oldScript.textContent}\n})();`;
      oldScript.replaceWith(newScript);
    });
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