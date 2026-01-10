const User = require("../models/userModel");


const userAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    }else {
        return res.redirect("/login");
    }
};


const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/admin/login");
    }
};


module.exports = {
    userAuth,
    adminAuth
}