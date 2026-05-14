import Batch from "../../models/batchModel.js";


export const addBatch = async (req, res) => {
  try {
    const { productId, variantId, manufacturedAt, expiryDays, initialStock } = req.body;

    const mfd = new Date(manufacturedAt);
    const expiryAt = new Date(mfd);
    expiryAt.setDate(expiryAt.getDate() + Number(expiryDays));

    await Batch.create({
      productId,
      variantId,
      manufacturedAt: mfd,
      expiryAt,
      initialStock,
      availableStock: initialStock,
      status: "active"
    });

    res.redirect(`/admin/variants/${variantId}`);
  } catch (error) {
    console.log(error);
    res.status(500).send("Add batch failed");
  }
};

// UPDATE BATCH
// UPDATE BATCH
export const updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { manufacturedAt, expiryDays, initialStock } = req.body;

    const batch = await Batch.findById(batchId);

    const mfd = new Date(manufacturedAt);
    const expiryAt = new Date(mfd);
    expiryAt.setDate(expiryAt.getDate() + Number(expiryDays));

    const now = new Date();
    const isExpired = expiryAt < now;

    // ✅ Calculate difference based on original initialStock
    const difference = Number(initialStock) - batch.initialStock;

    // ✅ If batch was expired (availableStock forced to 0), base it on initialStock instead
    const baseAvailable = batch.status === "expired" ? 0 : batch.availableStock;
    const newAvailableStock = Math.max(0, baseAvailable + difference);

    // ✅ Reset status: if new expiry is in the future, make it active again
    const newStatus = isExpired ? "expired" : (newAvailableStock === 0 ? "exhausted" : "active");

    await Batch.findByIdAndUpdate(batchId, {
      manufacturedAt: mfd,
      expiryAt,
      initialStock: Number(initialStock),
      availableStock: isExpired ? 0 : newAvailableStock,
      status: newStatus
    }, { new: true });

    res.redirect(`/admin/variants/${batch.variantId}`);
  } catch (err) {
    console.log(err);
    res.status(500).send("Batch update failed");
  }
};