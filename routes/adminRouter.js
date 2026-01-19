const express = require("express");
const router = express.Router();

const {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
} = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController")
const {adminAuth} = require("../middlewares/auth");

router.get("/login", loadLogin);
router.post("/login", login);
router.get("/", adminAuth, loadDashboard);
router.get("/pagenotfound", pageerror);
router.get("/logout",logout);

// adminRoutes.js
router.get('/admin/users', async (req, res) => {
    const users = await User.find(); 
    res.render('admin-users', { users });
});


router.get("/users",adminAuth,customerController.customerInfo);
router.get("/block-user/:id", adminAuth, customerController.blockUser);
router.get("/unblock-user/:id", adminAuth, customerController.unblockUser);

module.exports = router;
