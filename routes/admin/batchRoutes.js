const express = require("express");
const router = express.Router();
const batchController = require("../../controllers/admin/batchController");

// add batch
router.post("/add", batchController.addBatch);

// update batch
router.post("/edit/:batchId", batchController.updateBatch);

module.exports = router;