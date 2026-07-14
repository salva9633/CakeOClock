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


export const updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { manufacturedAt, expiryDays, initialStock } = req.body;
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).send("Batch not found");
    }
    const mfd = new Date(manufacturedAt);
    const expiryAt = new Date(mfd);
    expiryAt.setDate(expiryAt.getDate() + Number(expiryDays));
    const now = new Date();
    const isExpired = expiryAt < now;
    const newInitialStock = Number(initialStock);

    const newAvailableStock = isExpired ? 0 : newInitialStock;

    const newStatus = isExpired
      ? "expired"
      : newAvailableStock === 0
      ? "exhausted"
      : "active";

    await Batch.findByIdAndUpdate(
      batchId,
      {
        manufacturedAt: mfd,
        expiryAt,
        initialStock: newInitialStock,
        availableStock: newAvailableStock,
        status: newStatus
      },
      { new: true }
    );

    res.redirect(`/admin/variants/${batch.variantId}`);
  } catch (err) {
    console.log(err);
    res.status(500).send("Batch update failed");
  }
};