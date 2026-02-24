const Batch = require("../../models/batchModel");
const calculateSafeOffer = require("../../utils/expiryOfferCalculator");

const loadNearExpiryDeals = async (req, res) => {
  try {
    const today = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(today.getDate() + 2);

    const batches = await Batch.find({
      expiryAt: { $gte: today, $lte: twoDaysLater },
      availableStock: { $gt: 0 },
      status: "active"
    })
      .populate("productId")
      .populate("variantId")
      .lean();

const deals = batches
  .filter(b => b.productId && b.productId.isListed)
  .map(batch => {
    const offer = calculateSafeOffer(batch.variantId);

    return {
      product: batch.productId,
      variant: batch.variantId,
      expiryAt: batch.expiryAt,
      offerPrice: offer.offerPrice,
      discountPercent: offer.discountPercent,
      stock: batch.availableStock
    };
  });


    res.render("near-expiry", { deals });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports = { loadNearExpiryDeals };
