import User from "../models/userModel.js";

// ✅ Blocks admin + blocked users from user pages
const userAuth = async (req, res, next) => {
  try {

    if (!req.session.user) {
      // ── AJAX / JSON requests → return JSON so frontend can show popup ──
      const isAjax = req.xhr || req.headers['content-type']?.includes('application/json');
      if (isAjax) {
        return res.status(401).json({ success: false, redirectUrl: "/login" });
      }
      return res.redirect("/login");
    }
    const userId = req.session.user.id || req.session.user;

    const user = await User.findById(userId).lean();
if (!user || user.isAdmin) {
      req.session.destroy((err) => {
        if (err) console.log("Session destroy error:", err);
        const isAjax = req.xhr || req.headers['content-type']?.includes('application/json');
        if (isAjax) {
          return res.status(401).json({ success: false, redirectUrl: "/login" });
        }
        return res.redirect("/login");
      });
      return;
    }
  if (user.isBlocked) {
      req.session.destroy((err) => {
        if (err) console.log("Session destroy error:", err);
        const isAjax = req.xhr || req.headers['content-type']?.includes('application/json');
        if (isAjax) {
          return res.status(401).json({ success: false, redirectUrl: "/login" });
        }
        return res.redirect("/login");
      });
      return;
    }

    // ✅ IMPORTANT
    req.user = user;

    next();
} catch (error) {
    console.log("userAuth error:", error);
const isAjax = req.xhr 
  || req.headers['content-type']?.includes('application/json')
  || req.headers['accept']?.includes('application/json');    if (isAjax) {
      return res.status(401).json({ success: false, redirectUrl: "/login" });
    }
    return res.redirect("/login");
  }
};

const userNotLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  return next();
};

const adminAuth = (req, res, next) => {
  if (req.session?.admin?.role !== "admin") {
    return res.redirect("/admin/login");
  }
  return next();
};

export { userAuth, adminAuth, userNotLoggedIn };