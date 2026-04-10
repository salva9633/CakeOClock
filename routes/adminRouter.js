const express = require("express");
const router = express.Router();
const expressLayouts = require("express-ejs-layouts");

router.use(expressLayouts);
router.use((req, res, next) => {
  res.locals.layout = "layout";
  next();
});

const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const upload = require("../middlewares/multer");
const { adminAuth } = require("../middlewares/auth");
const productRoutes = require("./admin/productRoutes");
const variantRoutes = require("./admin/variantRoutes"); // ✅ ADDED
const batchRoutes = require("./admin/batchRoutes");     // ✅ ADDED

const {
  loadLogin, login, loadDashboard, pageerror, logout
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

router.delete("/category/delete/:id", adminAuth, categoryController.deleteCategory);
router.patch("/category/edit/:id", adminAuth, upload.single("image"), categoryController.editCategory);
router.post("/category/add", adminAuth, upload.single("image"), categoryController.addCategory);

/* PRODUCTS */
router.use("/products", adminAuth, productRoutes);

/* VARIANTS */
router.use("/variants", adminAuth, variantRoutes); // ✅ ADDED

/* BATCHES */
router.use("/batches", adminAuth, batchRoutes);    // ✅ ADDED

module.exports = router;