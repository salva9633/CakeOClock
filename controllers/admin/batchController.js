const Batch = require("../../models/batchModel");

// ADD BATCH
exports.addBatch = async (req, res) => {
  try {
    const {
      productId,
      variantId,
      manufacturedAt,
      expiryDays,
      initialStock
    } = req.body;

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

    res.redirect(`/admin/products/${productId}`);

  } catch (error) {
    console.log(error);
    res.status(500).send("Add batch failed");
  }
};
