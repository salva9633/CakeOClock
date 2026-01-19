const User = require("../models/userModel");
const userAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    return next();
};

const adminAuth = (req, res, next) => {
    if (req.session?.admin?.role !== "admin") {
        return res.redirect("/admin/login");
    }
    return next();
};

module.exports = {
    userAuth,
    adminAuth
};