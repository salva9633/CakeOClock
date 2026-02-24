const express = require("express");
const router = express.Router();

const expressLayouts = require("express-ejs-layouts");

// ✅ Enable layouts ONLY for admin
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

router.patch(
  "/category/status/:id",
  adminAuth,
  categoryController.toggleCategoryStatus
);

router.delete(
  "/category/delete/:id",
  adminAuth,
  categoryController.deleteCategory
);

router.patch(
  "/category/edit/:id",
  adminAuth,
  upload.single("image"),
  categoryController.editCategory
);

router.post(
  "/category/add",
  adminAuth,
  upload.single("image"),
  categoryController.addCategory
);

/* PRODUCT */

router.get(
  "/products",
  adminAuth,
  productController.getProducts
);

router.post(
  "/products/add",
  adminAuth,
  upload.array("images", 5),
  productController.addProduct
);

router.get(
  "/products/:productId",
  adminAuth,
  productController.getProductDetail
);

router.post(
  "/products/edit/:productId",
  adminAuth,
  upload.array("images", 5),   // 🔥 VERY IMPORTANT
  productController.editProduct
);

router.patch(
  "/products/toggle/:productId",
  adminAuth,
  productController.toggleProductListing
);


module.exports = router;
