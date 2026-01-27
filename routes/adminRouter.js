const express = require("express");
const router = express.Router();

const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const upload = require("../middlewares/multer");
const { adminAuth } = require("../middlewares/auth");

const {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout
} = require("../controllers/admin/adminController");

router.get("/login", loadLogin);
router.post("/login", login);
router.get("/", adminAuth, loadDashboard);
router.get("/pagenotfound", pageerror);
router.get("/logout", logout);

/* USERS */
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/block-user/:id", adminAuth, customerController.blockUser);
router.get("/unblock-user/:id", adminAuth, customerController.unblockUser);

/* CATEGORY */
router.get("/category", adminAuth, categoryController.categoryInfo);
router.patch("/category/status/:id", adminAuth, categoryController.toggleCategoryStatus);
router.post(
  "/category/add",
  adminAuth,
  upload.single("image"),
  categoryController.addCategory
);
module.exports = router;
