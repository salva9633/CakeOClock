const User = require("../models/userModel");
const bcrypt = require("bcrypt");

// admin error page
const pageerror = (req, res) => {
    res.render("admin-error");
};

// load admin login
const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render("admin-login", { message: null });
};

// admin login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.redirect("/admin/login");
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.redirect("/admin/login");
        }

        req.session.admin = true;
        return res.redirect("/admin");

    } catch (error) {
        console.log("Login error:", error);
        res.redirect("/admin/pageerror");
    }
};

// load admin dashboard
const loadDashboard = (req, res) => {
    try {
        res.render("dashboard");
    } catch (error) {
        console.log("Dashboard error:", error);
        res.redirect("/admin/pageerror");
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror
};