import express from "express";
import { addVariant, getVariantDetail, updateVariant } from "../../controllers/admin/variantController.js";

const router = express.Router();

router.post("/add", addVariant);
router.get("/:variantId", getVariantDetail);
router.post("/edit/:variantId", updateVariant);

export default router;
