const upload = require("../../middlewares/multer"); 
const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");

// ✅ STATIC ROUTES FIRST
router.post(
  "/add",
  upload.array("images", 5),
  productController.addProduct
);


// ✅ DYNAMIC ROUTES LAST
router.get("/:productId", productController.getProductDetail);

// list products
router.get("/", productController.getProducts);

module.exports = router;

