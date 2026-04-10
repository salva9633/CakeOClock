const express = require("express");
const router = express.Router();
const variantController = require("../../controllers/admin/variantController");

// add variant
router.post("/add", variantController.addVariant);

// variant detail
router.get("/:variantId", variantController.getVariantDetail);

// update variant
router.post("/edit/:variantId", variantController.updateVariant);

module.exports = router;