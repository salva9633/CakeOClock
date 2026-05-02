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
export const updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { manufacturedAt, expiryDays, initialStock } = req.body;

    const batch = await Batch.findById(batchId);

    const mfd = new Date(manufacturedAt);
    const expiryAt = new Date(mfd);
    expiryAt.setDate(expiryAt.getDate() + Number(expiryDays));

    
    const difference = Number(initialStock) - batch.initialStock;
    const newAvailableStock = batch.availableStock + difference;

    await Batch.findByIdAndUpdate(batchId, {
      manufacturedAt: mfd,
      expiryAt,
      initialStock: Number(initialStock),
      availableStock: newAvailableStock
    }, { new: true });

    res.redirect(`/admin/variants/${batch.variantId}`);
  } catch (err) {
    console.log(err);
    res.status(500).send("Batch update failed");
  }
};
