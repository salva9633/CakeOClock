const express = require("express");
const router = express.Router();
const batchController = require("../../controllers/admin/batchController");

// add batch
router.post("/add", batchController.addBatch);

module.exports = router;
