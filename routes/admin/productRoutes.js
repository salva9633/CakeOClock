const upload = require("../../middlewares/multer"); 
const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");

// ADD PRODUCT
router.post(
  "/add",
  upload.array("images", 5),
  productController.addProduct
);

// EDIT PRODUCT  ✅ FIXED
router.post(
  "/edit/:productId",
  upload.array("images", 5),
  productController.editProduct
);

// LIST PRODUCTS
// LIST PRODUCTS
router.get("/", productController.getProducts);

// TOGGLE VISIBILITY
router.patch("/toggle/:id", productController.toggleProductListing);

// PRODUCT DETAILS
router.get("/:productId", productController.getProductDetail);

module.exports = router;