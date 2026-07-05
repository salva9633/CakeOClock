export function renderAdmin(req, res, view, data = {}) {
  const isAjax =
    req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest";

  if (isAjax) {
    res.render(view, { ...data, layout: false });
  } else {
    res.render(view, data);
  }
}