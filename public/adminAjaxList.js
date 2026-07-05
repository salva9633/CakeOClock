function initAjaxList({ url, containerSelector, inputSelector, onLoaded }) {
  const container = document.querySelector(containerSelector);
  const input = document.querySelector(inputSelector);
  if (!container) return;

  let debounceTimer = null;

  async function load(params, { pushState = true } = {}) {
    const query = new URLSearchParams(params).toString();
    try {
      const res = await fetch(`${url}?${query}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      const html = await res.text();
      container.innerHTML = html;
      if (pushState) history.pushState({ ajax: true }, "", `${url}?${query}`);
      if (typeof onLoaded === "function") onLoaded(container);
    } catch (err) {
      console.error("AJAX list load failed:", err);
    }
  }

  if (input) {
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load({ search: input.value, page: 1 }), 500);
    });
  }

  container.addEventListener("click", (e) => {
    const pageBtn = e.target.closest(".page-btn[data-page]");
    if (!pageBtn || pageBtn.classList.contains("disabled")) return;
    e.preventDefault();
    load({ search: input ? input.value : "", page: pageBtn.dataset.page });
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    load(Object.fromEntries(params.entries()), { pushState: false });
  });

  return { load };
}