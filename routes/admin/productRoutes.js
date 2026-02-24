const upload = require("../../middlewares/multer"); 
const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");

router.post(
  "/add",
  upload.array("images", 5),
  productController.addProduct
);

router.get("/:productId", productController.getProductDetail);

// list products
router.get("/", productController.getProducts);

router.patch("/toggle/:productId", productController.toggleProductListing);

router.post("/edit/:productId", productController.editProduct);


module.exports = router;

