import express from "express";
import upload from "../../middlewares/multer.js";
import { addProduct, editProduct, getProducts, toggleProductListing, getProductDetail } from "../../controllers/admin/productController.js";

const router = express.Router();

router.get("/", getProducts);
router.post("/add", upload.array("images", 5), addProduct);
router.post("/edit/:productId", upload.array("images", 5), editProduct);
router.patch("/toggle/:id", toggleProductListing);
router.get("/:productId", getProductDetail);

export default router;


