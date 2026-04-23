import express from "express";
import { addBatch, updateBatch } from "../../controllers/admin/batchController.js";

const router = express.Router();

router.post("/add", addBatch);
router.post("/edit/:batchId", updateBatch);

export default router;
