const express = require("express");
const router = express.Router();

const {
    loadLogin,
    login,
    loadDashboard,
    pageerror
} = require("../controllers/adminController");

const {adminAuth} = require("../middlewares/auth");

router.get("/login", loadLogin);
router.post("/login", login);
router.get("/", adminAuth, loadDashboard);
router.get("/pagenotfound", pageerror);

module.exports = router;
