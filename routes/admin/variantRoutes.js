const express = require("express");
const router = express.Router();
const variantController = require("../../controllers/admin/variantController");

// add variant
router.post("/add", variantController.addVariant);

// variant detail (batch page)
router.get("/:variantId", variantController.getVariantDetail);

module.exports = router;
