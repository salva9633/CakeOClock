import User from "../models/userModel.js";

// ✅ Blocks admin + blocked users from user pages
const userAuth = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const user = await User.findById(req.session.user.id).lean();

  if (!user || user.isAdmin) {
    req.session.destroy();
    return res.redirect("/login");
  }

  if (user.isBlocked) {
    req.session.destroy();
    return res.redirect("/login");
  }

  return next();
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