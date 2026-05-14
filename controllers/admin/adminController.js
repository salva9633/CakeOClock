import User from "../../models/userModel.js";
import bcrypt from "bcrypt";

// ─────────────────────────────────────────
// ERROR PAGE
// ─────────────────────────────────────────
const pageerror = (req, res) => {
  return res.render("admin-error");
};

// ─────────────────────────────────────────
// LOAD LOGIN
// ─────────────────────────────────────────
const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      // ✅ DB verify — don't trust session blindly
      const admin = await User.findById(req.session.admin.id).lean();
      if (admin && admin.isAdmin && !admin.isBlocked) {
        return res.redirect("/admin");
      }
      // ✅ Stale session — remove only admin data
      delete req.session.admin;
    }
    return res.render("admin-login", { message: null, layout: false });
  } catch (error) {
    console.error("loadLogin error:", error);
    return res.render("admin-login", { message: null, layout: false });
  }
};

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Basic input check
    if (!email || !password) {
      return res.render("admin-login", { message: "Please enter email and password", layout: false });
    }

    const admin = await User.findOne({ email, isAdmin: true });
    if (!admin) {
      return res.render("admin-login", { message: "Invalid credentials", layout: false });
    }

    if (admin.isBlocked) {
      return res.render("admin-login", { message: "Account is blocked", layout: false });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("admin-login", { message: "Invalid credentials", layout: false });
    }

    // ✅ Store name + email so header.ejs can use admin.name
    req.session.admin = {
      id:    admin._id,
      name:  admin.name,
      email: admin.email,
      role:  "admin"
    };

    return res.redirect("/admin");

  } catch (error) {
    console.error("Login error:", error);
    return res.redirect("/admin/pageerror");
  }
};

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────
const loadDashboard = (req, res) => {
  try {
    return res.render("dashboard");
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.redirect("/admin/pageerror");
  }
};

// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────
const logout = (req, res) => {
  try {
    req.session.destroy((err) => {        // ✅ destroy, not delete
      if (err) console.error("Logout error:", err);
      res.clearCookie("admin_sid");       // ✅ correct cookie name
      return res.redirect("/admin/login");
    });


    
  } catch (error) {
    console.error("Logout error:", error);
    return res.redirect("/admin/pageerror");
  }
};

export { loadLogin, login, loadDashboard, pageerror, logout };